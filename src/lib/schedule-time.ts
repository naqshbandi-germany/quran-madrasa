// Der Unterricht findet in Nordzypern statt (Ortszeit UTC+3, ganzjaehrig, ohne
// Zeitumstellung). Die Zeiten der Stundenplan-Eintraege (ScheduleSlot) werden
// deshalb in dieser Ortszeit gespeichert und fuer die Anzeige in deutsche Zeit
// (Europe/Berlin, MEZ/MESZ) umgerechnet - die Verschiebung wechselt mit der
// deutschen Zeitumstellung zwischen 1 und 2 Stunden.
const TEACHING_UTC_OFFSET_MINUTES = 180;
const DISPLAY_TIME_ZONE = "Europe/Berlin";

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
