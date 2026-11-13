// Erzeugt eine iCalendar-Datei (RFC 5545) mit den Sitzungen eines Kontos. Zeiten werden in UTC
// geschrieben, Kalender-Apps zeigen sie in der jeweiligen Ortszeit an.

type CalendarEvent = {
  id: string;
  title: string;
  courseTitle: string;
  startsAt: Date;
  durationMin: number;
  url: string;
};

function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

// Zeilen laenger als 75 Zeichen muessen umbrochen werden (Fortsetzung mit Leerzeichen).
function fold(line: string) {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

export function buildCalendar(name: string, host: string, events: CalendarEvent[]) {
  const now = icsDate(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Islam unter Freunden//Kurstermine//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(name)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ];
  for (const event of events) {
    const end = new Date(event.startsAt.getTime() + event.durationMin * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@${host}`,
      `DTSTAMP:${now}`,
      `DTSTART:${icsDate(event.startsAt)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsText(`${event.courseTitle}: ${event.title}`)}`,
      `DESCRIPTION:${icsText(`Zum Unterricht: ${event.url}`)}`,
      `URL:${event.url}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT30M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsText(event.courseTitle)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
