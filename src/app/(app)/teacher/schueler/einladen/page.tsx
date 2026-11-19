import Link from "next/link";

import { auth } from "@/auth";
import { StudentInviteForm } from "@/components/student-invite-form";
import { editableEmail } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";
import { formatZonedDateTime } from "@/lib/schedule-time";
import { timeZoneLabel } from "@/lib/time-zones";
import { resolveViewTimeZone } from "@/lib/view-time-zone";

export const metadata = { title: "Schüler einladen" };
export const dynamic = "force-dynamic";

// Einladen zu einem Kurs (Anmeldung mit Bezahlung) oder zu einer kostenlosen Probestunde, auch
// mehrere Personen auf einmal. Mit ?gaeste=<Probestunde> stehen deren Gaeste schon in der Liste
// (z. B. um sie nach der Probestunde zum Kurs einzuladen).
export default async function InviteStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kurs?: string; probestunde?: string; gaeste?: string }>;
}) {
  const session = await auth();
  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN";
  const { kurs, probestunde, gaeste } = await searchParams;

  const [courses, view, inviteEmail, trialEmail, sender] = await Promise.all([
    prisma.course.findMany({
      where: { isPublished: true, ...(isAdmin ? {} : { teacherId: session.user.id }) },
      orderBy: { title: "asc" },
      select: { id: true, title: true, isHidden: true, teacher: { select: { name: true } } },
    }),
    resolveViewTimeZone(session.user.id),
    editableEmail("student_invite", session.user.id),
    editableEmail("trial_invite", session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
  ]);
  const timeZone = view.timeZone;

  // Kommende Probestunden der sichtbaren Kurse, zu denen weitere Personen dazukommen koennen.
  const trials = await prisma.trialLesson.findMany({
    where: { canceledAt: null, startsAt: { gt: new Date() }, courseId: { in: courses.map((c) => c.id) } },
    orderBy: { startsAt: "asc" },
    include: { _count: { select: { guests: true } } },
  });
  const trialOptions = trials.map((t) => ({
    id: t.id,
    courseId: t.courseId,
    courseTitle: courses.find((c) => c.id === t.courseId)?.title ?? "",
    when: `${formatZonedDateTime(t.startsAt, timeZone)} Uhr`,
    label: `${formatZonedDateTime(t.startsAt, timeZone)} Uhr (${t._count.guests} eingeladen)`,
  }));
  const preselectedTrial = trials.find((t) => t.id === probestunde);

  // Probestunden der letzten 90 Tage und kommende, deren Gaeste sich uebernehmen lassen.
  const recentTrials = await prisma.trialLesson.findMany({
    where: {
      canceledAt: null,
      startsAt: { gt: new Date(new Date().getTime() - 90 * 86_400_000) },
      courseId: { in: courses.map((c) => c.id) },
      guests: { some: {} },
    },
    orderBy: { startsAt: "desc" },
    take: 30,
    include: { guests: { orderBy: { createdAt: "asc" }, select: { name: true, email: true } } },
  });
  const guestSources = recentTrials.map((t) => ({
    id: t.id,
    courseId: t.courseId,
    label: `${courses.find((c) => c.id === t.courseId)?.title ?? ""}, ${formatZonedDateTime(t.startsAt, timeZone)} Uhr (${t.guests.length} ${t.guests.length === 1 ? "Gast" : "Gäste"})`,
    guests: t.guests,
  }));
  const guestTrial = recentTrials.find((t) => t.id === gaeste);

  const initialCourseId =
    preselectedTrial?.courseId ??
    guestTrial?.courseId ??
    courses.find((c) => c.id === kurs)?.id ??
    (courses.length === 1 ? courses[0].id : "");

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-azure-800">Schüler einladen</h1>
        <p className="mt-1 text-sm text-brand-600">
          Wähle den Kurs und gib die Schüler ein, gern mehrere auf einmal. Der Einladungslink (14 Tage gültig) führt zur
          Kursanmeldung; wer noch kein Konto hat, legt dabei eines an. Bezahlt wird wie gewohnt
          {isAdmin ? ", außer du wählst „ohne Zahlung“" : ""}. Alternativ lädst du zu einer kostenlosen Probestunde ein.
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="border border-brand-200 bg-white p-4 text-sm text-brand-600">
          Einladen ist möglich, sobald ein Kurs veröffentlicht ist.
        </p>
      ) : (
        <section className="border border-gold-400/40 bg-white p-5">
          <StudentInviteForm
            // Neue Vorbelegung (andere Probestunde) baut das Formular neu auf.
            key={gaeste ?? "leer"}
            courses={courses.map((c) => ({
              id: c.id,
              title: c.isHidden ? `${c.title} (versteckt)` : c.title,
              teacherName: c.teacher.name,
            }))}
            initialCourseId={initialCourseId}
            emails={{ student_invite: inviteEmail, trial_invite: trialEmail }}
            senderName={sender?.name ?? session.user.name ?? ""}
            guestSources={guestSources}
            initialEntries={guestTrial?.guests ?? []}
            trials={trialOptions}
            initialTrialId={preselectedTrial?.id}
            allowFree={isAdmin}
            timeZoneHint={timeZone === "Europe/Berlin" ? "deutscher Zeit" : `deiner Zeitzone: ${timeZoneLabel(timeZone)}`}
          />
        </section>
      )}

      <Link href="/teacher/schueler" className="inline-block text-sm font-medium text-brand-700 underline">
        Zurück zur Schülerliste
      </Link>
    </div>
  );
}
