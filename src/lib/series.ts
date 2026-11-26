import type { Weekday } from "@prisma/client";

import { createClassroomMeetings } from "@/lib/classroom";
import { WEEKDAY_LABELS, WEEKDAY_ORDER, WEEKDAY_SHORT } from "@/lib/course-labels";
import { sendSeriesChangeNotice } from "@/lib/notification-email";
import { prisma } from "@/lib/prisma";
import { convertSlotZone, fromZonedLocal, timeToMinutes, toGermanTime } from "@/lib/schedule-time";
import { teacherTimeZone } from "@/lib/time-zones";
import { deleteZoomMeeting, updateZoomMeeting } from "@/lib/zoom";

// Terminserien (SessionSeries): Aus einer Serie entstehen die Stundenplan-Eintraege (immer) und,
// sobald der Kurs gestartet ist, die einzelnen Stunden mit Meeting-Link. Wird die Serie
// geaendert, gleicht syncSeriesSessions die kommenden Stunden an; einzeln verschobene oder
// abgesagte Stunden (isException) bleiben, wie sie sind.

const UTC_DAY: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

// Hoechstens ein Jahr pro Serie (schuetzt vor Tippfehlern wie 2062 statt 2026).
export const MAX_SERIES_DAYS = 366;

type SeriesTimes = {
  weekdays: Weekday[];
  startTime: string;
  endTime: string;
  firstDate: Date | null;
  lastDate: Date | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Tag einer @db.Date-Spalte (UTC-Mitternacht) als "YYYY-MM-DD".
export function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function seriesDurationMin(series: { startTime: string; endTime: string }) {
  return timeToMinutes(series.endTime) - timeToMinutes(series.startTime);
}

export function sortWeekdays(weekdays: readonly string[]) {
  return [...weekdays].sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
}

// Alle Termine der Serie im Zeitraum, Uhrzeit in der Zeitzone der Lehrkraft.
export function seriesOccurrences(series: SeriesTimes, timeZone: string) {
  if (!series.firstDate || !series.lastDate) return [];
  const days = new Set(series.weekdays.map((d) => UTC_DAY[d]));
  const [hours, minutes] = series.startTime.split(":").map(Number);
  const result: { date: Date; startsAt: Date }[] = [];
  for (let i = 0; i <= MAX_SERIES_DAYS; i++) {
    const date = new Date(series.firstDate.getTime() + i * 86_400_000);
    if (date > series.lastDate) break;
    if (!days.has(date.getUTCDay())) continue;
    const startsAt = fromZonedLocal(
      { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() },
      hours,
      minutes,
      timeZone,
    );
    result.push({ date, startsAt });
  }
  return result;
}

// Wochentage und Uhrzeiten von einer Zeitzone in eine andere umrechnen (z. B. Serie einer
// Lehrkraft in Nordzypern fuer einen Admin in deutscher Zeit anzeigen und bearbeiten).
export function convertSeriesZone<T extends { weekdays: Weekday[]; startTime: string; endTime: string }>(
  series: T,
  fromTimeZone: string,
  toTimeZone: string,
): T {
  if (fromTimeZone === toTimeZone || series.weekdays.length === 0) return series;
  const converted = series.weekdays.map((weekday) =>
    convertSlotZone({ weekday, startTime: series.startTime, endTime: series.endTime }, fromTimeZone, toTimeZone),
  );
  return {
    ...series,
    weekdays: converted.map((c) => c.weekday as Weekday),
    startTime: converted[0].startTime,
    endTime: converted[0].endTime,
  };
}

// Kurzform fuer Listen, z. B. "Mo, Mi 18:00–19:00".
export function formatSeriesTimes(series: { weekdays: readonly string[]; startTime: string; endTime: string }) {
  const days = sortWeekdays(series.weekdays)
    .map((d) => WEEKDAY_SHORT[d] ?? d)
    .join(", ");
  return `${days} ${series.startTime}–${series.endTime}`;
}

const dateFormat = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", day: "numeric", month: "numeric", year: "numeric" });

export function formatSeriesPeriod(series: { firstDate: Date | null; lastDate: Date | null }) {
  if (series.firstDate && series.lastDate)
    return `${dateFormat.format(series.firstDate)} – ${dateFormat.format(series.lastDate)}`;
  if (series.firstDate) return `ab ${dateFormat.format(series.firstDate)}`;
  if (series.lastDate) return `bis ${dateFormat.format(series.lastDate)}`;
  return null;
}

// Stundenplan-Eintraege der Serie neu schreiben (einer je Wochentag).
export async function syncSeriesSlots(seriesId: string) {
  const series = await prisma.sessionSeries.findUniqueOrThrow({ where: { id: seriesId } });
  await prisma.$transaction([
    prisma.scheduleSlot.deleteMany({ where: { seriesId } }),
    prisma.scheduleSlot.createMany({
      data: series.weekdays.map((weekday) => ({
        courseId: series.courseId,
        seriesId,
        weekday,
        startTime: series.startTime,
        endTime: series.endTime,
        note: series.note,
      })),
    }),
  ]);
}

export type SyncResult = { created: number; updated: number; removed: number; warnings: string[] };

const EMPTY_RESULT: SyncResult = { created: 0, updated: 0, removed: 0, warnings: [] };

// Kommende Stunden der Serie an die Serie angleichen: fehlende anlegen (mit Meeting-Link),
// geaenderte anpassen, ueberzaehlige entfernen. Nur fuer gestartete Kurse und Serien mit
// Zeitraum. Schlaegt das Anlegen der Zoom-Meetings fehl, wird keine neue Stunde gespeichert
// und der Fehler weitergereicht.
export async function syncSeriesSessions(seriesId: string, options: { notify?: boolean } = {}): Promise<SyncResult> {
  const series = await prisma.sessionSeries.findUniqueOrThrow({
    where: { id: seriesId },
    include: {
      course: { include: { teacher: { select: { zoomEmail: true, timeZone: true } } } },
      sessions: true,
    },
  });
  if (!series.course.startedAt || !series.firstDate || !series.lastDate) return { ...EMPTY_RESULT, warnings: [] };

  const now = new Date();
  const timeZone = teacherTimeZone(series.course.teacher);
  const durationMin = seriesDurationMin(series);
  const desired = seriesOccurrences(series, timeZone).filter((o) => o.startsAt > now);
  const desiredKeys = new Set(desired.map((o) => dateKey(o.date)));
  const byDate = new Map(series.sessions.filter((s) => s.seriesDate).map((s) => [dateKey(s.seriesDate!), s]));
  const result: SyncResult = { created: 0, updated: 0, removed: 0, warnings: [] };

  // Ueberzaehlige kommende Stunden entfernen (z. B. Wochentag gestrichen, Zeitraum verkuerzt).
  for (const s of series.sessions) {
    if (s.startsAt <= now || s.isException) continue;
    if (s.seriesDate && desiredKeys.has(dateKey(s.seriesDate))) continue;
    if (s.zoomMeetingId) await deleteZoomMeeting(s.zoomMeetingId);
    await prisma.classSession.delete({ where: { id: s.id } });
    result.removed++;
  }

  // Bestehende anpassen, fehlende sammeln.
  const missing: typeof desired = [];
  for (const o of desired) {
    const s = byDate.get(dateKey(o.date));
    if (!s) {
      missing.push(o);
      continue;
    }
    if (s.isException) continue;
    const moved = s.startsAt.getTime() !== o.startsAt.getTime();
    if (!moved && s.title === series.title && s.durationMin === durationMin) continue;
    if (s.zoomMeetingId) {
      try {
        await updateZoomMeeting(s.zoomMeetingId, { topic: series.title, startsAt: o.startsAt, durationMin });
      } catch (err) {
        console.error(`Zoom-Meeting ${s.zoomMeetingId} konnte nicht angepasst werden:`, err);
        result.warnings.push(zoomUpdateWarning(err));
      }
    }
    await prisma.classSession.update({
      where: { id: s.id },
      data: {
        title: series.title,
        startsAt: o.startsAt,
        durationMin,
        ...(moved ? { reminder24hSentAt: null, reminder1hSentAt: null, reminderStartSentAt: null } : {}),
      },
    });
    result.updated++;
  }

  if (missing.length > 0) {
    const meetings = await createClassroomMeetings(
      missing.map((o) => ({
        courseSlug: series.course.slug,
        title: series.title,
        startsAt: o.startsAt,
        durationMin,
        teacherZoomEmail: series.course.teacher.zoomEmail,
      })),
    );
    await prisma.classSession.createMany({
      data: missing.map((o, i) => ({
        courseId: series.courseId,
        seriesId: series.id,
        seriesDate: o.date,
        title: series.title,
        startsAt: o.startsAt,
        durationMin,
        joinUrl: meetings[i].joinUrl,
        classroomType: meetings[i].classroomType,
        zoomMeetingId: meetings[i].zoomMeetingId,
      })),
    });
    result.created = missing.length;
  }

  if (options.notify && (result.updated > 0 || result.removed > 0)) {
    await sendSeriesChangeNotice(series.courseId, describeSeriesForMail(series, timeZone));
  }

  // Doppelte Hinweise (z. B. fehlende Zoom-Berechtigung bei jeder Stunde) nur einmal zeigen.
  result.warnings = [...new Set(result.warnings)];
  return result;
}

// Kommende Stunden der Serie entfernen (Serie beenden). Teilnehmer bekommen eine Mail.
export async function removeUpcomingSeriesSessions(seriesId: string) {
  const now = new Date();
  const sessions = await prisma.classSession.findMany({ where: { seriesId, startsAt: { gt: now } } });
  for (const s of sessions) {
    if (s.zoomMeetingId) await deleteZoomMeeting(s.zoomMeetingId);
  }
  await prisma.classSession.deleteMany({ where: { id: { in: sessions.map((s) => s.id) } } });
  return sessions.filter((s) => !s.cancelledAt).length;
}

export function zoomUpdateWarning(err: unknown) {
  const detail = err instanceof Error ? err.message : String(err);
  return `Das Zoom-Meeting konnte nicht angepasst werden (${detail}). Der Link bleibt gültig, nur die Zeit im Zoom-Kalender stimmt evtl. nicht.`;
}

// Fuer die Mail an die Teilnehmer: Zeiten in deutscher Zeit, z. B.
// "Montag und Mittwoch, 18:00–19:00 Uhr (deutsche Zeit), 1.12.2026 – 25.2.2027".
export function describeSeriesForMail(
  series: SeriesTimes & { title: string },
  timeZone: string,
) {
  const german = sortWeekdays(series.weekdays).map((weekday) =>
    toGermanTime({ weekday, startTime: series.startTime, endTime: series.endTime }, new Date(), timeZone),
  );
  const days = german.map((g) => WEEKDAY_LABELS[g.weekday] ?? g.weekday);
  const dayText = days.length > 1 ? `${days.slice(0, -1).join(", ")} und ${days.at(-1)}` : days[0];
  const period = formatSeriesPeriod(series);
  return `${dayText}, ${german[0].startTime}–${german[0].endTime} Uhr (deutsche Zeit)${period ? `, ${period}` : ""}`;
}
