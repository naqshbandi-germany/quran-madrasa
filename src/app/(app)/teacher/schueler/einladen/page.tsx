import Link from "next/link";

import { auth } from "@/auth";
import { StudentInviteForm } from "@/components/student-invite-form";
import { prisma } from "@/lib/prisma";
import { formatZonedDateTime } from "@/lib/schedule-time";
import { timeZoneLabel } from "@/lib/time-zones";
import { resolveViewTimeZone } from "@/lib/view-time-zone";

export const metadata = { title: "Schüler einladen" };
export const dynamic = "force-dynamic";

// Einladen zu einem Kurs (Anmeldung mit Bezahlung) oder zu einer kostenlosen Probestunde, auch
// mehrere Personen auf einmal.
export default async function InviteStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kurs?: string; probestunde?: string }>;
}) {
  const session = await auth();
  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN";
  const { kurs, probestunde } = await searchParams;

  const [courses, view] = await Promise.all([
    prisma.course.findMany({
      where: { isPublished: true, ...(isAdmin ? {} : { teacherId: session.user.id }) },
      orderBy: { title: "asc" },
      select: { id: true, title: true, isHidden: true },
    }),
    resolveViewTimeZone(session.user.id),
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
    when: `${formatZonedDateTime(t.startsAt, timeZone)} Uhr`,
    label: `${formatZonedDateTime(t.startsAt, timeZone)} Uhr (${t._count.guests} eingeladen)`,
  }));
  const preselectedTrial = trials.find((t) => t.id === probestunde);
  const initialCourseId =
    preselectedTrial?.courseId ?? courses.find((c) => c.id === kurs)?.id ?? (courses.length === 1 ? courses[0].id : "");

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
            courses={courses.map((c) => ({ id: c.id, title: c.isHidden ? `${c.title} (versteckt)` : c.title }))}
            initialCourseId={initialCourseId}
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
