import { prisma } from "@/lib/prisma";
import { formatZonedDateTime } from "@/lib/schedule-time";
import { fullName } from "@/lib/names";

// Abgleich von Eingeladenen ueber die E-Mail-Adresse: Wer ist schon bekannt (Konto, offene
// Einladung, Probestunde), und wer wurde zu einem Kurs eingeladen, ist aber noch nicht
// angemeldet? So entstehen keine doppelten Eintraege, wenn dieselbe Person unter
// verschiedenen Namen eingeladen wird.

// Probestunden, die laenger als so viele Tage zurueckliegen, gelten nicht mehr als offen.
const TRIAL_PENDING_DAYS = 60;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

const dateFormat = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin" });

// Ist die Adresse bei einem Teilnehmer dieses Kurses hinterlegt (eigene Adresse des
// Teilnehmers oder Adresse des Kontos)?
export async function enrolledEmails(courseId: string) {
  const enrollments = await prisma.enrollment.findMany({
    where: { courseId },
    select: { participant: { select: { email: true } }, user: { select: { email: true } } },
  });
  const set = new Set<string>();
  for (const e of enrollments) {
    if (e.participant.email) set.add(normalizeEmail(e.participant.email));
    set.add(normalizeEmail(e.user.email));
  }
  return set;
}

export type KnownInvitee = {
  email: string;
  // Name, unter dem die Person schon bekannt ist (Konto oder fruehere Einladung).
  name: string;
  // Kurzer Name fuer die Einladung (muslimischer Name, falls angegeben).
  inviteName: string;
  hasAccount: boolean;
  enrolledHere: boolean;
  // z. B. "zur Probestunde am 18.11.2026, 18:00 eingeladen"
  notes: string[];
};

// Was ist zu dieser E-Mail-Adresse schon bekannt? Lehrkraefte sehen nur Einladungen und
// Probestunden ihrer eigenen Kurse. Gibt null zurueck, wenn die Adresse unbekannt ist.
export async function lookupInvitee(params: {
  email: string;
  courseId: string | null;
  viewer: { id: string; isAdmin: boolean };
  timeZone: string;
}): Promise<KnownInvitee | null> {
  const email = normalizeEmail(params.email);
  const ownCourses = params.viewer.isAdmin ? {} : { course: { teacherId: params.viewer.id } };
  const now = new Date();

  const [user, invitations, guests, enrolled] = await Promise.all([
    prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { name: true, muslimName: true, role: true },
    }),
    prisma.invitation.findMany({
      where: { email: { equals: email, mode: "insensitive" }, expiresAt: { gt: now }, usedAt: null, ...ownCourses },
      select: { name: true, createdAt: true, courseId: true, course: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trialGuest.findMany({
      where: {
        email: { equals: email, mode: "insensitive" },
        trialLesson: { canceledAt: null, startsAt: { gt: new Date(now.getTime() - TRIAL_PENDING_DAYS * 86_400_000) }, ...ownCourses },
      },
      select: { name: true, trialLesson: { select: { startsAt: true, courseId: true, course: { select: { title: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    params.courseId ? enrolledEmails(params.courseId) : Promise.resolve(new Set<string>()),
  ]);

  if (!user && invitations.length === 0 && guests.length === 0) return null;

  const otherCourse = (courseId: string, title: string) => (courseId === params.courseId ? "" : ` (${title})`);
  const notes: string[] = [];
  for (const g of guests) {
    const when = formatZonedDateTime(g.trialLesson.startsAt, params.timeZone);
    const past = g.trialLesson.startsAt < now;
    notes.push(
      `${past ? "war" : "ist"} zur Probestunde am ${when} Uhr eingeladen${otherCourse(g.trialLesson.courseId, g.trialLesson.course.title)}`,
    );
  }
  for (const i of invitations) {
    notes.push(`Einladung zur Anmeldung vom ${dateFormat.format(i.createdAt)}${otherCourse(i.courseId, i.course.title)}`);
  }

  const earlierName = guests[0]?.name || invitations.find((i) => i.name)?.name || "";
  return {
    email,
    name: user ? fullName(user) : earlierName,
    inviteName: user ? user.muslimName?.trim() || user.name : earlierName,
    hasAccount: Boolean(user),
    enrolledHere: enrolled.has(email),
    notes,
  };
}

export type PendingInvitee = {
  key: string;
  name: string;
  email: string | null;
  hasAccount: boolean;
  // z. B. ["Probestunde am 18.11.2026, 18:00 Uhr", "Einladung zur Anmeldung vom 17.11.2026"]
  status: string[];
  // Einladungslink ohne E-Mail-Adresse, noch keinem Probestunden-Gast zugeordnet: moegliche Gaeste.
  assign: { invitationId: string; guests: { id: string; label: string }[] } | null;
};

// Eingeladene eines Kurses, die (noch) nicht angemeldet sind: offene Einladungen und Gaeste von
// Probestunden der letzten Wochen. Gleiche E-Mail-Adresse oder verknuepfter Gast = eine Person (eine
// Zeile). Gleiche Namen allein werden nicht zusammengefasst, das koennen zwei Personen sein.
export async function pendingInvitees(courseId: string, timeZone: string): Promise<PendingInvitee[]> {
  const now = new Date();
  const [invitations, guests, enrolled] = await Promise.all([
    prisma.invitation.findMany({
      where: { courseId, expiresAt: { gt: now }, usedAt: null },
      select: { id: true, name: true, email: true, createdAt: true, expiresAt: true, trialGuestId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.trialGuest.findMany({
      where: {
        trialLesson: {
          courseId,
          canceledAt: null,
          startsAt: { gt: new Date(now.getTime() - TRIAL_PENDING_DAYS * 86_400_000) },
        },
        // Ueber einen verknuepften Einladungslink schon angemeldet
        invitations: { none: { courseId, usedAt: { not: null } } },
      },
      select: { id: true, name: true, email: true, trialLesson: { select: { startsAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    enrolledEmails(courseId),
  ]);

  type Acc = { key: string; names: string[]; email: string | null; status: string[] };
  const byKey = new Map<string, Acc>();
  function entry(key: string, email: string | null) {
    let acc = byKey.get(key);
    if (!acc) {
      acc = { key, names: [], email, status: [] };
      byKey.set(key, acc);
    }
    return acc;
  }
  function addName(acc: Acc, name: string | null) {
    const n = name?.trim();
    if (n && !acc.names.includes(n)) acc.names.push(n);
  }

  // Adresse einer Person aus dem Gast oder der verknuepften Einladung
  const emailByGuest = new Map<string, string>();
  for (const i of invitations) {
    if (i.trialGuestId && i.email) emailByGuest.set(i.trialGuestId, normalizeEmail(i.email));
  }
  for (const g of guests) if (g.email) emailByGuest.set(g.id, normalizeEmail(g.email));

  for (const g of guests) {
    const email = emailByGuest.get(g.id) ?? null;
    if (email && enrolled.has(email)) continue;
    const acc = entry(email ?? `gast-${g.id}`, email);
    addName(acc, g.name);
    const when = formatZonedDateTime(g.trialLesson.startsAt, timeZone);
    const line = `${g.trialLesson.startsAt < now ? "Probestunde war am" : "Probestunde am"} ${when} Uhr`;
    if (!acc.status.includes(line)) acc.status.push(line);
  }
  for (const i of invitations) {
    const email = i.email
      ? normalizeEmail(i.email)
      : i.trialGuestId
        ? (emailByGuest.get(i.trialGuestId) ?? null)
        : null;
    if (email && enrolled.has(email)) continue;
    const acc = entry(email ?? (i.trialGuestId ? `gast-${i.trialGuestId}` : `einladung-${i.id}`), email);
    addName(acc, i.name);
    acc.status.push(
      `${i.email ? "Einladung" : "Einladungslink"} zur Anmeldung vom ${dateFormat.format(i.createdAt)} (gültig bis ${dateFormat.format(i.expiresAt)})`,
    );
  }

  // Fuer die Zuordnung von Hand: Gaeste ohne E-Mail-Adresse, denen noch kein Link zugeordnet ist.
  const linked = new Set(invitations.flatMap((i) => i.trialGuestId ?? []));
  const openGuests = guests
    .filter((g) => !g.email && !linked.has(g.id))
    .map((g) => ({ id: g.id, label: `${g.name}, Probestunde am ${formatZonedDateTime(g.trialLesson.startsAt, timeZone)} Uhr` }));
  const unassigned = new Map(
    invitations.filter((i) => !i.email && !i.trialGuestId).map((i) => [`einladung-${i.id}`, i.id]),
  );

  const emails = [...byKey.values()].flatMap((a) => (a.email ? [a.email] : []));
  const users = emails.length
    ? await prisma.user.findMany({
        where: { OR: emails.map((e) => ({ email: { equals: e, mode: "insensitive" as const } })) },
        select: { email: true, name: true, muslimName: true },
      })
    : [];
  const userByEmail = new Map(users.map((u) => [normalizeEmail(u.email), u]));

  return [...byKey.values()].map((acc) => {
    const user = acc.email ? userByEmail.get(acc.email) : undefined;
    return {
      key: acc.key,
      name: user ? fullName(user) : acc.names.join(" / ") || "Ohne Namen",
      email: acc.email,
      hasAccount: Boolean(user),
      status: acc.status,
      assign:
        unassigned.has(acc.key) && openGuests.length > 0
          ? { invitationId: unassigned.get(acc.key)!, guests: openGuests }
          : null,
    };
  });
}
