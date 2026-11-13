import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { REVIEW_SAMPLE_SELECT, ReadingSampleReviewList } from "@/components/reading-sample-review-list";
import { saveSessionEvaluation } from "@/lib/evaluation-actions";
import { prisma } from "@/lib/prisma";
import { formatGermanDateTime, formatTeachingDateTime } from "@/lib/schedule-time";
import {
  ATTENDANCE_LABELS,
  SURAH_OPTIONS,
  TAJWEED_LABELS,
  formatSurahPosition,
} from "@/lib/surahs";

const INPUT = "border border-brand-300 px-3 py-2";

export default async function EvaluateSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sessionId: string }>;
  searchParams: Promise<{ gespeichert?: string }>;
}) {
  const { id, sessionId } = await params;
  const { gespeichert } = await searchParams;

  const classSession = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      evaluations: true,
      course: {
        include: {
          enrollments: { include: { participant: true }, orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!classSession || classSession.courseId !== id) notFound();

  const session = await auth();
  if (session?.user.role !== "ADMIN" && session?.user.id !== classSession.course.teacherId) notFound();

  const evaluationByParticipant = new Map(classSession.evaluations.map((e) => [e.participantId, e]));

  // Teilnehmer der Stunde: aktuell Eingeschriebene plus Ausgetretene mit vorhandener Auswertung.
  const participants = classSession.course.enrollments.map((e) => e.participant);
  const missing = classSession.evaluations
    .map((e) => e.participantId)
    .filter((pid) => !participants.some((p) => p.id === pid));
  if (missing.length > 0) {
    participants.push(...(await prisma.participant.findMany({ where: { id: { in: missing } } })));
  }

  // Letzter bekannter Lernstand aus frueheren Stunden als Hinweis (wird nicht vorausgefuellt, damit nichts ungewollt gespeichert wird).
  const previous = await prisma.sessionEvaluation.findMany({
    where: {
      participantId: { in: participants.map((p) => p.id) },
      surah: { not: null },
      session: { courseId: id, startsAt: { lt: classSession.startsAt } },
    },
    orderBy: { session: { startsAt: "desc" } },
    select: { participantId: true, surah: true, ayah: true },
  });
  const lastPosition = new Map<string, { surah: number | null; ayah: number | null }>();
  for (const p of previous) if (!lastPosition.has(p.participantId)) lastPosition.set(p.participantId, p);

  const samples = await prisma.readingSample.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: REVIEW_SAMPLE_SELECT,
  });

  const isFuture = classSession.startsAt > new Date();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/teacher/courses/${id}`} className="text-sm text-brand-700 underline">
          ← {classSession.course.title}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-azure-800">Stunde auswerten</h1>
        <p className="text-brand-700">
          {classSession.title} · {formatTeachingDateTime(classSession.startsAt)} Ortszeit (
          {formatGermanDateTime(classSession.startsAt)} deutsche Zeit)
        </p>
      </div>

      {gespeichert && (
        <p role="status" className="border border-green-700/30 bg-green-50 px-4 py-2 text-sm text-green-900">
          Gespeichert.
        </p>
      )}
      {isFuture && (
        <p className="border border-gold-400/40 bg-brand-50 px-4 py-2 text-sm text-brand-800">
          Diese Stunde liegt noch in der Zukunft. Inhalt und Hausaufgabe kannst du schon eintragen,
          die Anwesenheit am besten erst nach der Stunde.
        </p>
      )}

      <form action={saveSessionEvaluation} className="space-y-6">
        <input type="hidden" name="sessionId" value={classSession.id} />

        <section className="space-y-3 border border-gold-400/40 bg-white p-5">
          <h2 className="font-semibold text-azure-800">Für alle Teilnehmer</h2>
          <label className="flex flex-col text-sm text-brand-700">
            Was wurde durchgenommen?
            <textarea
              name="lessonContent"
              rows={3}
              maxLength={2000}
              defaultValue={classSession.lessonContent ?? ""}
              placeholder="z. B. Sure Al-Mulk, Verse 1–15; Regel Idgham"
              className={`mt-1 ${INPUT}`}
            />
          </label>
          <label className="flex flex-col text-sm text-brand-700">
            Hausaufgabe bis zur nächsten Stunde
            <textarea
              name="homework"
              rows={2}
              maxLength={2000}
              defaultValue={classSession.homework ?? ""}
              placeholder="z. B. Verse 16–30 täglich zweimal laut lesen"
              className={`mt-1 ${INPUT}`}
            />
          </label>
          <label className="flex flex-col text-sm text-brand-700">
            Leseprobe vor dieser Stunde erbitten (optional)
            <input
              name="readingRequest"
              maxLength={500}
              defaultValue={classSession.readingRequest ?? ""}
              placeholder="z. B. Sure Al-Mulk, Verse 1–10"
              className={`mt-1 ${INPUT}`}
            />
            <span className="mt-1 text-xs text-brand-600">
              Erscheint im Dashboard der Teilnehmer und in der Erinnerung 24 Stunden vor der Stunde.
            </span>
          </label>
        </section>

        <section className="space-y-3">
          <h2 className="font-semibold text-azure-800">
            Pro Teilnehmer ({participants.length})
          </h2>
          <p className="text-sm text-brand-600">
            Sichtbar nur für die jeweilige Person bzw. die Eltern, nicht für andere Teilnehmer.
            Leere Felder werden nicht gespeichert.
          </p>
          {participants.length === 0 && (
            <p className="text-sm text-brand-600">In diesem Kurs ist noch niemand eingeschrieben.</p>
          )}

          {participants.map((participant) => {
            const evaluation = evaluationByParticipant.get(participant.id);
            const last = lastPosition.get(participant.id);
            const pid = participant.id;
            return (
              <fieldset key={pid} className="space-y-3 border border-gold-400/40 bg-white p-5">
                <legend className="px-1 font-semibold text-brand-900">{participant.name}</legend>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm" role="radiogroup" aria-label="Anwesenheit">
                  {(Object.keys(ATTENDANCE_LABELS) as (keyof typeof ATTENDANCE_LABELS)[]).map((status) => (
                    <label key={status} className="inline-flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={`attendance_${pid}`}
                        value={status}
                        defaultChecked={evaluation?.attendance === status}
                      />
                      {ATTENDANCE_LABELS[status]}
                    </label>
                  ))}
                  <label className="inline-flex items-center gap-1.5 text-brand-600">
                    <input
                      type="radio"
                      name={`attendance_${pid}`}
                      value=""
                      defaultChecked={!evaluation?.attendance}
                    />
                    keine Angabe
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-[2fr_1fr_2fr]">
                  <label className="flex flex-col text-sm text-brand-700">
                    Stand: Sure
                    <select
                      name={`surah_${pid}`}
                      defaultValue={String(evaluation?.surah ?? "")}
                      className={`mt-1 ${INPUT}`}
                    >
                      <option value="">–</option>
                      {SURAH_OPTIONS.map((s) => (
                        <option key={s.number} value={s.number}>
                          {s.number} {s.name} ({s.ayahs} Verse)
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col text-sm text-brand-700">
                    Vers
                    <input
                      name={`ayah_${pid}`}
                      type="number"
                      min={1}
                      max={286}
                      defaultValue={evaluation?.ayah ?? ""}
                      className={`mt-1 ${INPUT}`}
                    />
                  </label>
                  <label className="flex flex-col text-sm text-brand-700">
                    Tadschwid
                    <select
                      name={`tajweed_${pid}`}
                      defaultValue={String(evaluation?.tajweedRating ?? "")}
                      className={`mt-1 ${INPUT}`}
                    >
                      <option value="">–</option>
                      {Object.entries(TAJWEED_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {!evaluation?.surah && last && (
                  <p className="text-xs text-brand-600">
                    Stand aus der letzten Auswertung: {formatSurahPosition(last.surah, last.ayah)}
                  </p>
                )}

                <label className="flex flex-col text-sm text-brand-700">
                  Persönliche Rückmeldung
                  <textarea
                    name={`comment_${pid}`}
                    rows={2}
                    maxLength={2000}
                    defaultValue={evaluation?.comment ?? ""}
                    className={`mt-1 ${INPUT}`}
                  />
                </label>
              </fieldset>
            );
          })}
        </section>

        <button className="btn-primary px-5 py-2">Auswertung speichern</button>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-azure-800">Leseproben zu dieser Stunde ({samples.length})</h2>
          <Link href={`/teacher/courses/${id}/leseproben`} className="text-sm text-brand-700 underline">
            Alle Leseproben des Kurses
          </Link>
        </div>
        <ReadingSampleReviewList samples={samples} />
      </section>
    </div>
  );
}
