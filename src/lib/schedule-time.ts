import { DEFAULT_TIME_ZONE } from "@/lib/time-zones";

// Zeiten im Unterricht: Stundenplan-Eintraege (ScheduleSlot) sind in der Ortszeit der Lehrkraft
// gespeichert (User.timeZone, Standard deutsche Zeit), konkrete Termine (ClassSession.startsAt)
// als echter Zeitpunkt. Oeffentlich angezeigt wird immer deutsche Zeit (MEZ/MESZ).
const DISPLAY_TIME_ZONE = DEFAULT_TIME_ZONE;

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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Datum (Jahr, Monat, Tag) des naechsten Auftretens des Wochentags in der Zeitzone.
function nextLocalDate(weekday: string, timeZone: string, now: Date) {
  const local = new Date(now.getTime() + zoneOffsetMinutes(timeZone, now) * 60_000);
  const targetIndex = WEEKDAYS_BY_UTC_DAY.indexOf(weekday);
  const daysAhead = targetIndex === -1 ? 0 : (targetIndex - local.getUTCDay() + 7) % 7;
  const d = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + daysAhead));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function toDisplayZone(instant: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: DISPLAY_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    weekday: get("weekday").toUpperCase(),
    time: `${get("hour")}:${get("minute")}`,
  };
}

// Rechnet einen Stundenplan-Eintrag aus der Ortszeit der Lehrkraft in deutsche Zeit um (die
// Verschiebung kann sich mit der Zeitumstellung aendern, daher mit Bezug auf "now").
export function toGermanTime<T extends SlotLike>(slot: T, now: Date = new Date(), fromTimeZone: string = DEFAULT_TIME_ZONE): T {
  if (fromTimeZone === DISPLAY_TIME_ZONE) return slot;
  const date = nextLocalDate(slot.weekday, fromTimeZone, now);
  const start = toDisplayZone(parseZonedDateTime(`${date}T${slot.startTime}`, fromTimeZone));
  const end = toDisplayZone(parseZonedDateTime(`${date}T${slot.endTime}`, fromTimeZone));
  return { ...slot, weekday: start.weekday, startTime: start.time, endTime: end.time };
}

// Wie toGermanTime, aber fuer eine reine Uhrzeit-Spanne ohne festen Wochentag.
export function toGermanTimeRange(
  startTime: string,
  endTime: string,
  now: Date = new Date(),
  fromTimeZone: string = DEFAULT_TIME_ZONE,
) {
  const weekday = WEEKDAYS_BY_UTC_DAY[now.getUTCDay()];
  const converted = toGermanTime({ weekday, startTime, endTime }, now, fromTimeZone);
  return { startTime: converted.startTime, endTime: converted.endTime };
}

// Um wie viele Stunden die Zeitzone der deutschen Zeit gerade voraus ist (negativ = zurueck).
export function hoursAheadOfGermany(timeZone: string, now: Date = new Date()) {
  return (zoneOffsetMinutes(timeZone, now) - zoneOffsetMinutes(DISPLAY_TIME_ZONE, now)) / 60;
}

export { timeToMinutes };

export function formatGermanDateTime(date: Date, dateStyle: "medium" | "full" = "medium") {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: DISPLAY_TIME_ZONE,
    dateStyle,
    timeStyle: "short",
  }).format(date);
}

// Ein Tag (YYYY-MM-DD) und eine Uhrzeit (HH:MM) in der Zeitzone als Zeitpunkt.
export function fromZonedLocal(date: { year: number; month: number; day: number }, hours: number, minutes: number, timeZone: string) {
  return parseZonedDateTime(`${date.year}-${pad(date.month)}-${pad(date.day)}T${pad(hours)}:${pad(minutes)}`, timeZone);
}

// --- Zeitpunkte in beliebiger Zeitzone (IANA-Name, z. B. "Europe/Berlin") -------------

// Abstand der Zeitzone zu UTC in Minuten zum gegebenen Zeitpunkt (Sommerzeit beruecksichtigt).
export function zoneOffsetMinutes(timeZone: string, date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, Number(p.value)]),
  );
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return Math.round((asUtc - Math.floor(date.getTime() / 60_000) * 60_000) / 60_000);
}

// Wert eines <input type="datetime-local"> ("2026-10-14T16:00") als Ortszeit der Zeitzone.
export function parseZonedDateTime(value: string, timeZone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Ungültiges Datum/Uhrzeit-Format.");
  const [, y, mo, d, h, mi] = match.map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Zweimal rechnen, damit Tage mit Zeitumstellung stimmen.
  const first = guess - zoneOffsetMinutes(timeZone, new Date(guess)) * 60_000;
  return new Date(guess - zoneOffsetMinutes(timeZone, new Date(first)) * 60_000);
}

export function formatZonedDateTime(date: Date, timeZone: string, dateStyle: "medium" | "full" = "medium") {
  return new Intl.DateTimeFormat("de-DE", { timeZone, dateStyle, timeStyle: "short" }).format(date);
}

// Gegenstueck zu parseZonedDateTime: Wert fuer ein <input type="datetime-local">.
export function toZonedInputValue(date: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
