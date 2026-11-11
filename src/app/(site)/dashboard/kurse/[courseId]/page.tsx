import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { formatAttendance, getProgressSummaries } from "@/lib/progress";
import { prisma } from "@/lib/prisma";
import { formatGermanDateTime } from "@/lib/schedule-time";
import { ATTENDANCE_LABELS, TAJWEED_LABELS, formatSurahPosition } from "@/lib/surahs";

const ATTENDANCE_STYLE = {
  PRESENT: "bg-green-50 text-green-900 border-green-700/30",
  EXCUSED: "bg-brand-50 text-brand-800 border-brand-300",
  ABSENT: "bg-red-50 text-red-900 border-red-700/30",
} as const;

// Lernverlauf eines Kurses fuer den Konto-Inhaber: Inhalt und Hausaufgabe jeder Stunde sowie
// Anwesenheit und Rueckmeldungen der eigenen Teilnehmer (nie die anderer Konten).
export default async function CourseProgressPage({ params }: { params: Promise<{ courseId: string }> }) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { courseId } = await params;

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } });
  if (!course) notFound();

  // Eigene Teilnehmer, die im Kurs sind oder waren (Auswertung vorhanden).
  const participants = await prisma.participant.findMany({
    where: {
      ownerId: session.user.id,
      OR: [{ enrollments: { some: { courseId } } }, { evaluations: { some: { session: { courseId } } } }],
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (participants.length === 0) notFound();
  const participantIds = participants.map((p) => p.id);

  const [sessions, summaries] = await Promise.all([
    prisma.classSession.findMany({
      where: { courseId, startsAt: { lt: new Date() } },
      orderBy: { startsAt: "desc" },
      include: { evaluations: { where: { participantId: { in: participantIds } } } },
    }),
    getProgressSummaries(courseId, participantIds),
  ]);
  const nameOf = new Map(participants.map((p) => [p.id, p.name]));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-brand-700 underline">
          ← Meine Kurse
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-azure-800">Lernverlauf: {course.title}</h1>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        {participants.map((p) => {
          const s = summaries.get(p.id);
          return (
            <div key={p.id} className="border border-gold-400/40 bg-white p-4 text-sm">
              <h2 className="font-semibold text-azure-800">{p.name}</h2>
              <dl className="mt-2 space-y-1 text-brand-800">
                <div>
                  <dt className="inline text-brand-600">Anwesenheit: </dt>
                  <dd className="inline">{s ? formatAttendance(s) : "noch nicht erfasst"}</dd>
                </div>
                <div>
                  <dt className="inline text-brand-600">Aktueller Stand: </dt>
                  <dd className="inline">{s?.position ?? "noch nicht eingetragen"}</dd>
                </div>
                {s?.tajweedRating != null && (
                  <div>
                    <dt className="inline text-brand-600">Tadschwid: </dt>
                    <dd className="inline">{TAJWEED_LABELS[s.tajweedRating]}</dd>
                  </div>
                )}
              </dl>
            </div>
          );
        })}
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-azure-800">Vergangene Stunden</h2>
        {sessions.length === 0 && <p className="text-sm text-brand-600">Noch keine Stunden vorbei.</p>}
        <ol className="space-y-4">
          {sessions.map((cs) => (
            <li key={cs.id} className="border border-gold-400/40 bg-white p-4 text-sm">
              <p className="font-medium text-brand-900">
                {cs.title} <span className="font-normal text-brand-600">· {formatGermanDateTime(cs.startsAt)} Uhr</span>
              </p>
              {cs.lessonContent && (
                <p className="mt-2 whitespace-pre-line">
                  <span className="font-semibold text-azure-800">Inhalt: </span>
                  {cs.lessonContent}
                </p>
              )}
              {cs.homework && (
                <p className="mt-1 whitespace-pre-line">
                  <span className="font-semibold text-azure-800">Hausaufgabe: </span>
                  {cs.homework}
                </p>
              )}
              {cs.evaluations.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-brand-100 pt-3">
                  {cs.evaluations.map((e) => (
                    <li key={e.id}>
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{nameOf.get(e.participantId)}</span>
                        {e.attendance && (
                          <span className={`border px-2 py-0.5 text-xs ${ATTENDANCE_STYLE[e.attendance]}`}>
                            {ATTENDANCE_LABELS[e.attendance]}
                          </span>
                        )}
                        {e.surah && <span className="text-brand-700">{formatSurahPosition(e.surah, e.ayah)}</span>}
                        {e.tajweedRating != null && (
                          <span className="text-brand-700">Tadschwid {e.tajweedRating}/5</span>
                        )}
                      </p>
                      {e.comment && <p className="mt-1 whitespace-pre-line text-brand-900/85">{e.comment}</p>}
                    </li>
                  ))}
                </ul>
              )}
              {!cs.lessonContent && !cs.homework && cs.evaluations.length === 0 && (
                <p className="mt-1 text-brand-600">Noch keine Notizen zu dieser Stunde.</p>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
