import { getAppUrl } from "@/lib/app-url";
import { groupRecipients } from "@/lib/enrollment-recipients";
import { escapeHtml } from "@/lib/html";
import { prisma } from "@/lib/prisma";
import { deliverEmail, EMAIL_FROM } from "@/lib/resend";
import { formatGermanDateTime } from "@/lib/schedule-time";

// Benachrichtigungen ausserhalb der Erinnerungen: Bestaetigung der Anmeldung, verschobene oder
// abgesagte Stunden und fehlgeschlagene Zahlungen. Ein Fehler beim Versand wird protokolliert,
// bricht aber die eigentliche Aktion (Webhook, Aenderung durch die Lehrkraft) nicht ab.

function when(date: Date) {
  return `${formatGermanDateTime(date, "full")} Uhr (deutsche Zeit)`;
}

function button(href: string, label: string) {
  return `
    <p style="margin: 24px 0;">
      <a href="${href}" style="background: #3f6b31; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
        ${escapeHtml(label)}
      </a>
    </p>`;
}

function layout(greetingName: string, body: string, footer: string) {
  return `
    <div style="font-family: sans-serif; color: #1f3616; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #3f6b31; font-size: 20px;">Quran Madrasa</h1>
      <p>Assalamu alaykum ${escapeHtml(greetingName)},</p>
      ${body}
      <p style="font-size: 13px; color: #7aa968;">${footer}</p>
    </div>`;
}

async function sendSafely(to: string, subject: string, html: string) {
  try {
    await deliverEmail({ from: EMAIL_FROM, to, subject, html });
  } catch (err) {
    console.error(`E-Mail "${subject}" an ${to} fehlgeschlagen:`, err);
  }
}

const enrollmentInclude = {
  user: { select: { name: true, email: true } },
  participant: { select: { name: true, email: true } },
} as const;

// Nach erfolgreicher Zahlung: Bestaetigung an die neu eingeschriebenen Teilnehmer (bzw. den
// Konto-Inhaber) mit den naechsten Terminen.
export async function sendEnrollmentConfirmation(courseId: string, enrollmentIds: string[]) {
  if (enrollmentIds.length === 0) return;
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      teacher: { select: { name: true } },
      sessions: { where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 3 },
    },
  });
  if (!course) return;
  const enrollments = await prisma.enrollment.findMany({
    where: { id: { in: enrollmentIds } },
    include: enrollmentInclude,
  });

  const appUrl = getAppUrl();
  const sessionsHtml =
    course.sessions.length > 0
      ? `<p><strong>Die nächsten Termine:</strong></p><ul>${course.sessions
          .map((s) => `<li>${escapeHtml(s.title)}: ${when(s.startsAt)}</li>`)
          .join("")}</ul>`
      : "<p>Die Termine werden noch bekannt gegeben. Du bekommst vor jeder Stunde eine Erinnerung.</p>";

  for (const recipient of groupRecipients(enrollments)) {
    const names = recipient.participantNames.map(escapeHtml).join(", ");
    const body = `
      <p>die Anmeldung zum Kurs <strong>${escapeHtml(course.title)}</strong> bei
      ${escapeHtml(course.teacher.name)} ist bestätigt. Teilnehmer: ${names}.</p>
      ${sessionsHtml}
      <p>Vor jeder Stunde erinnern wir dich per E-Mail (24 Stunden und 1 Stunde vorher). Im Bereich
      „Meine Kurse“ findest du alle Termine, den Link zum Unterricht und ein Kalender-Abo für dein
      Handy oder deinen Computer.</p>
      ${button(`${appUrl}/dashboard`, "Zu meinen Kursen")}`;
    await sendSafely(
      recipient.email,
      `Anmeldung bestätigt: "${course.title}"`,
      layout(
        recipient.greetingName,
        body,
        "Diese E-Mail wurde automatisch nach deiner Anmeldung verschickt. Bei Fragen erreichst du uns unter admin@islamunterfreunden.de.",
      ),
    );
  }
}

type ChangedSession = { courseId: string; title: string; startsAt: Date };

// Lehrkraft hat eine kommende Stunde verschoben oder abgesagt: alle Teilnehmer informieren.
export async function sendSessionChangeNotice(
  kind: "moved" | "cancelled",
  before: ChangedSession,
  after?: { startsAt: Date; durationMin: number },
) {
  if (before.startsAt.getTime() < Date.now() && kind === "cancelled") return;
  const course = await prisma.course.findUnique({
    where: { id: before.courseId },
    include: { enrollments: { include: enrollmentInclude } },
  });
  if (!course || course.enrollments.length === 0) return;

  const appUrl = getAppUrl();
  const subject =
    kind === "moved"
      ? `Termin verschoben: "${course.title}"`
      : `Stunde fällt aus: "${course.title}"`;

  for (const recipient of groupRecipients(course.enrollments)) {
    const body =
      kind === "moved" && after
        ? `<p>die Stunde <strong>${escapeHtml(before.title)}</strong> im Kurs
           <strong>${escapeHtml(course.title)}</strong> wurde verschoben.</p>
           <p><strong>Bisher:</strong> <span style="text-decoration: line-through;">${when(before.startsAt)}</span><br />
           <strong>Neu:</strong> ${when(after.startsAt)} (${after.durationMin} Minuten)</p>
           <p>Der Link zum Unterricht bleibt gleich. Ein abonnierter Kalender aktualisiert sich von selbst.</p>`
        : `<p>die Stunde <strong>${escapeHtml(before.title)}</strong> im Kurs
           <strong>${escapeHtml(course.title)}</strong> am ${when(before.startsAt)} fällt leider aus.</p>
           <p>Über einen Ersatztermin informieren wir dich gesondert.</p>`;
    await sendSafely(
      recipient.email,
      subject,
      layout(
        recipient.greetingName,
        `${body}${button(`${appUrl}/dashboard`, "Alle Termine ansehen")}`,
        "Diese E-Mail wurde automatisch verschickt, weil du bei diesem Kurs eingeschrieben bist.",
      ),
    );
  }
}

// Stripe konnte eine Abo-Zahlung nicht einziehen: Konto-Inhaber bitten, die Zahlungsdaten zu
// pruefen. Stripe versucht es selbst noch einige Male (Einstellung im Stripe-Dashboard).
export async function sendPaymentFailedNotice(stripeCustomerId: string, courseId: string | null) {
  const user = await prisma.user.findUnique({ where: { stripeCustomerId } });
  if (!user) return;
  const course = courseId ? await prisma.course.findUnique({ where: { id: courseId } }) : null;
  const appUrl = getAppUrl();
  const courseText = course ? ` für den Kurs <strong>${escapeHtml(course.title)}</strong>` : "";
  const body = `
    <p>die letzte Zahlung${courseText} konnte leider nicht eingezogen werden, zum Beispiel weil die
    Karte abgelaufen ist oder das Konto nicht gedeckt war.</p>
    <p>Bitte prüfe deine Zahlungsdaten. Wir versuchen es in den nächsten Tagen automatisch noch
    einmal. Deine Teilnahme läuft bis dahin weiter.</p>
    ${button(`${appUrl}/dashboard/billing`, "Zahlungsdaten prüfen")}`;
  await sendSafely(
    user.email,
    "Zahlung fehlgeschlagen: bitte Zahlungsdaten prüfen",
    layout(user.name, body, "Bei Fragen erreichst du uns unter admin@islamunterfreunden.de."),
  );
}
