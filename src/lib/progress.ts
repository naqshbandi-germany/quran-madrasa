import { prisma } from "@/lib/prisma";
import { formatSurahPosition } from "@/lib/surahs";

export type ProgressSummary = {
  present: number;
  excused: number;
  absent: number;
  // Stunden mit eingetragener Anwesenheit
  recorded: number;
  position: string | null;
  tajweedRating: number | null;
};

// Fasst Anwesenheit und letzten Lernstand pro Teilnehmer in einem Kurs zusammen.
export async function getProgressSummaries(courseId: string, participantIds: string[]) {
  const evaluations = await prisma.sessionEvaluation.findMany({
    where: { participantId: { in: participantIds }, session: { courseId } },
    orderBy: { session: { startsAt: "desc" } },
    select: { participantId: true, attendance: true, surah: true, ayah: true, tajweedRating: true },
  });

  const summaries = new Map<string, ProgressSummary>();
  for (const id of participantIds) {
    summaries.set(id, { present: 0, excused: 0, absent: 0, recorded: 0, position: null, tajweedRating: null });
  }
  // Neueste zuerst: der erste Wert mit Sure bzw. Tadschwid ist der aktuelle Stand.
  for (const e of evaluations) {
    const s = summaries.get(e.participantId);
    if (!s) continue;
    if (e.attendance === "PRESENT") s.present++;
    if (e.attendance === "EXCUSED") s.excused++;
    if (e.attendance === "ABSENT") s.absent++;
    if (e.attendance) s.recorded++;
    if (!s.position && e.surah) s.position = formatSurahPosition(e.surah, e.ayah);
    if (s.tajweedRating == null && e.tajweedRating != null) s.tajweedRating = e.tajweedRating;
  }
  return summaries;
}

export function formatAttendance(s: ProgressSummary) {
  if (s.recorded === 0) return "noch nicht erfasst";
  const extra = [s.excused && `${s.excused} entschuldigt`, s.absent && `${s.absent} gefehlt`]
    .filter(Boolean)
    .join(", ");
  return `${s.present} von ${s.recorded} ${s.recorded === 1 ? "Stunde" : "Stunden"} anwesend${extra ? ` (${extra})` : ""}`;
}
