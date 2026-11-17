import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { ParticipantAdminForm } from "@/components/participant-admin-form";
import { REVIEW_SAMPLE_SELECT, ReadingSampleReviewList } from "@/components/reading-sample-review-list";
import { nameWithMuslimName } from "@/lib/course-manage";
import { prisma } from "@/lib/prisma";
import { formatAttendance, getProgressSummaries } from "@/lib/progress";
import { formatGermanDateTime } from "@/lib/schedule-time";
import { ATTENDANCE_LABELS, TAJWEED_LABELS, formatSurahPosition } from "@/lib/surahs";

export const dynamic = "force-dynamic";

const RELATION_LABELS = { SELF: "Konto-Inhaber selbst", CHILD: "Kind", OTHER: "andere erwachsene Person" } as const;
const TH = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-brand-700";
const TD = "px-3 py-2 align-top";

// Schuelerprofil: Lernfortschritt je Kurs (Anwesenheit, Stand, Tadschwid, Rueckmeldungen) und
// alle Hoerproben zum Anhoeren. Lehrkraefte sehen nur ihre eigenen Kurse, Admins alle und
// koennen zusaetzlich Name und Rufname aendern.
export default async function StudentProfilePage({ params }: { params: Promise<{ participantId: string }> }) {
  const { participantId } = await params;
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) notFound();
  const isAdmin = session.user.role === "ADMIN";

  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: {
      owner: { select: { name: true, email: true } },
      enrollments: {
        where: isAdmin ? {} : { course: { teacherId: session.user.id } },
        include: { course: { select: { id: true, title: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!participant || participant.enrollments.length === 0) notFound();

  const courseIds = participant.enrollments.map((e) => e.courseId);
  const [evaluations, samples, summaries] = await Promise.all([
    prisma.sessionEvaluation.findMany({
      where: { participantId, session: { courseId: { in: courseIds } } },
      include: { session: { select: { title: true, startsAt: true, courseId: true } } },
      orderBy: { session: { startsAt: "desc" } },
    }),
    prisma.readingSample.findMany({
      where: { participantId, courseId: { in: courseIds } },
      orderBy: [{ listenedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      select: { ...REVIEW_SAMPLE_SELECT, courseId: true },
    }),
    Promise.all(participant.enrollments.map((e) => getProgressSummaries(e.courseId, [participantId]))),
  ]);
  const dateFormat = new Intl.DateTimeFormat("de-DE");
  const unheard = samples.filter((s) => !s.listenedAt).length;

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-azure-800">{nameWithMuslimName(participant)}</h1>
        <p className="mt-1 text-sm text-brand-600">
          {RELATION_LABELS[participant.relation]}
          {participant.relation === "CHILD" && participant.birthYear ? `, Jahrgang ${participant.birthYear}` : ""}
          {" · "}
          {participant.email ?? `Kontakt über ${participant.owner.name}: ${participant.owner.email}`}
          {participant.relation !== "SELF" && participant.email && ` · Konto: ${participant.owner.name}`}
        </p>
      </div>

      <section aria-labelledby="fortschritt" className="space-y-4">
        <h2 id="fortschritt" className="text-lg font-semibold text-azure-800">
          Lernfortschritt
        </h2>
        {participant.enrollments.map((enrollment, index) => {
          const summary = summaries[index].get(participantId);
          const rows = evaluations.filter((e) => e.session.courseId === enrollment.courseId);
          return (
            <div key={enrollment.id} className="space-y-3 border border-gold-400/40 bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-brand-900">
                  <Link href={`/teacher/courses/${enrollment.courseId}`} className="hover:underline">
                    {enrollment.course.title}
                  </Link>
                  <span className="ml-2 text-sm font-normal text-brand-600">
                    seit {dateFormat.format(enrollment.createdAt)}
                  </span>
                </h3>
                <Link
                  href={`/teacher/courses/${enrollment.courseId}/nachrichten?an=${participantId}`}
                  className="text-sm font-medium text-azure-800 underline"
                >
                  Nachricht schreiben
                </Link>
              </div>
              {summary && (
                <dl className="grid gap-3 text-sm sm:grid-cols-3">
                  <div className="bg-brand-50 px-3 py-2">
                    <dt className="text-xs text-brand-600">Anwesenheit</dt>
                    <dd className="font-medium text-brand-900">{formatAttendance(summary)}</dd>
                  </div>
                  <div className="bg-brand-50 px-3 py-2">
                    <dt className="text-xs text-brand-600">Aktueller Stand</dt>
                    <dd className="font-medium text-brand-900">{summary.position ?? "noch nicht erfasst"}</dd>
                  </div>
                  <div className="bg-brand-50 px-3 py-2">
                    <dt className="text-xs text-brand-600">Tadschwid</dt>
                    <dd className="font-medium text-brand-900">
                      {summary.tajweedRating != null ? TAJWEED_LABELS[summary.tajweedRating] : "noch nicht erfasst"}
                    </dd>
                  </div>
                </dl>
              )}
              {rows.length === 0 ? (
                <p className="text-sm text-brand-600">
                  Noch keine ausgewerteten Stunden. Auswerten lässt sich jede Stunde im Kurs unter „Sitzungen“.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-brand-200">
                      <tr>
                        <th className={TH}>Stunde</th>
                        <th className={TH}>Anwesenheit</th>
                        <th className={TH}>Stand</th>
                        <th className={TH}>Tadschwid</th>
                        <th className={TH}>Rückmeldung</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100">
                      {rows.map((e) => (
                        <tr key={e.id}>
                          <td className={`${TD} whitespace-nowrap`}>
                            {formatGermanDateTime(e.session.startsAt)}
                            <span className="block text-xs text-brand-600">{e.session.title}</span>
                          </td>
                          <td className={TD}>{e.attendance ? ATTENDANCE_LABELS[e.attendance] : "–"}</td>
                          <td className={TD}>{formatSurahPosition(e.surah, e.ayah) ?? "–"}</td>
                          <td className={TD}>{e.tajweedRating != null ? `${e.tajweedRating}/5` : "–"}</td>
                          <td className={`${TD} whitespace-pre-line`}>{e.comment ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section aria-labelledby="hoerproben" className="space-y-4">
        <h2 id="hoerproben" className="text-lg font-semibold text-azure-800">
          Hörproben ({samples.length}
          {unheard > 0 ? `, ${unheard} noch nicht gehört` : ""})
        </h2>
        <ReadingSampleReviewList samples={samples} />
      </section>

      {isAdmin && (
        <section aria-labelledby="angaben" className="space-y-4 border border-gold-400/40 bg-white p-6">
          <div>
            <h2 id="angaben" className="text-lg font-semibold text-azure-800">
              Angaben bearbeiten
            </h2>
            <p className="text-sm text-brand-600">
              Nur für Admins.
              {participant.relation === "SELF" && " Name und muslimischer Name gelten auch für das Konto."}
            </p>
          </div>
          <ParticipantAdminForm
            participant={{
              id: participant.id,
              relation: participant.relation,
              name: participant.name,
              muslimName: participant.muslimName ?? "",
              email: participant.email ?? "",
              birthYear: participant.birthYear ? String(participant.birthYear) : "",
            }}
          />
        </section>
      )}
    </div>
  );
}
