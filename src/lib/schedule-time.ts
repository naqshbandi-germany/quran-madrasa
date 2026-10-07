// Der Unterricht findet in Nordzypern statt (Ortszeit UTC+3, ganzjaehrig, ohne
// Zeitumstellung). Die Zeiten der Stundenplan-Eintraege (ScheduleSlot) werden
// deshalb in dieser Ortszeit gespeichert und fuer die Anzeige in deutsche Zeit
// (Europe/Berlin, MEZ/MESZ) umgerechnet - die Verschiebung wechselt mit der
// deutschen Zeitumstellung zwischen 1 und 2 Stunden.
const TEACHING_UTC_OFFSET_MINUTES = 180;
const DISPLAY_TIME_ZONE = "Europe/Berlin";
// Gleiche Ortszeit wie TEACHING_UTC_OFFSET_MINUTES (Tuerkei/Nordzypern, UTC+3 ganzjaehrig).
const TEACHING_TIME_ZONE = "Europe/Istanbul";

const WEEKDAYS_BY_UTC_DAY = [
  "SUNDAY",
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

type SlotLike = { weekday: string; startTime: string; endTime: string };

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Mitternacht (Ortszeit) des naechsten Auftretens des Wochentags, als Zeitstempel,
// dessen UTC-Felder die Orts-Datumswerte tragen. Die Umrechnung nutzt das Datum des
// naechsten Termins, damit die Sommer-/Winterzeit-Grenze korrekt getroffen wird.
function nextLocalMidnight(weekday: string, now: Date) {
  const localNow = new Date(now.getTime() + TEACHING_UTC_OFFSET_MINUTES * 60_000);
  const todayIndex = localNow.getUTCDay();
  const targetIndex = WEEKDAYS_BY_UTC_DAY.indexOf(weekday);
  const daysAhead = targetIndex === -1 ? 0 : (targetIndex - todayIndex + 7) % 7;
  return Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate() + daysAhead,
  );
}

function toDisplayZone(instantMs: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday").toUpperCase(),
    time: `${get("hour")}:${get("minute")}`,
  };
}

export function toGermanTime<T extends SlotLike>(slot: T, now: Date = new Date()): T {
  const midnight = nextLocalMidnight(slot.weekday, now);
  const instant = (time: string) =>
    midnight + timeToMinutes(time) * 60_000 - TEACHING_UTC_OFFSET_MINUTES * 60_000;

  const start = toDisplayZone(instant(slot.startTime));
  const end = toDisplayZone(instant(slot.endTime));
  return { ...slot, weekday: start.weekday, startTime: start.time, endTime: end.time };
}

// Wie toGermanTime, aber fuer eine reine Uhrzeit-Spanne ohne festen Wochentag.
export function toGermanTimeRange(startTime: string, endTime: string, now: Date = new Date()) {
  const localNow = new Date(now.getTime() + TEACHING_UTC_OFFSET_MINUTES * 60_000);
  const weekday = WEEKDAYS_BY_UTC_DAY[localNow.getUTCDay()];
  const converted = toGermanTime({ weekday, startTime, endTime }, now);
  return { startTime: converted.startTime, endTime: converted.endTime };
}

// Um wie viele Stunden Nordzypern der deutschen Zeit gerade voraus ist (1 im
// Sommer, 2 im Winter).
export function hoursAheadOfGermany(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const berlinAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  const nowRounded = Math.floor(now.getTime() / 60_000) * 60_000;
  const berlinOffsetMinutes = Math.round((berlinAsUtc - nowRounded) / 60_000);
  return (TEACHING_UTC_OFFSET_MINUTES - berlinOffsetMinutes) / 60;
}

export { timeToMinutes };

// --- Konkrete Sitzungstermine (ClassSession.startsAt) ---------------------------
// Lehrer geben Termine in Nordzypern-Ortszeit ein; gespeichert wird der echte
// UTC-Zeitpunkt, angezeigt wird deutsche Zeit (Schueler) bzw. Ortszeit (Lehrer).

export function fromTeachingLocal(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
) {
  return new Date(
    Date.UTC(year, month - 1, day, hours, minutes) - TEACHING_UTC_OFFSET_MINUTES * 60_000,
  );
}

// Wert eines <input type="datetime-local">, z.B. "2026-10-14T16:00", in Ortszeit.
export function parseTeachingDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Ungültiges Datum/Uhrzeit-Format.");
  const [, y, mo, d, h, mi] = match.map(Number);
  return fromTeachingLocal(y, mo, d, h, mi);
}

export function formatGermanDateTime(date: Date, dateStyle: "medium" | "full" = "medium") {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: DISPLAY_TIME_ZONE,
    dateStyle,
    timeStyle: "short",
  }).format(date);
}

export function formatTeachingDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: TEACHING_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
