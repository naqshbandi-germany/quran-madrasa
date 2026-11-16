// Zeitzonen der Lehrkraefte. Standard ist deutsche Zeit (MEZ/MESZ); wer woanders lebt, kann im
// Lehrerprofil eine eigene Zeitzone waehlen. Darf auch im Browser verwendet werden.

export const DEFAULT_TIME_ZONE = "Europe/Berlin";

export const TIME_ZONE_OPTIONS = [
  { value: "Europe/Berlin", label: "Deutschland (MEZ/MESZ)" },
  { value: "Europe/Istanbul", label: "Türkei und Nordzypern (UTC+3)" },
  { value: "Europe/London", label: "Großbritannien (GMT/BST)" },
  { value: "Europe/Athens", label: "Griechenland, Zypern (OEZ/OESZ)" },
  { value: "Africa/Cairo", label: "Ägypten" },
  { value: "Asia/Riyadh", label: "Saudi-Arabien (UTC+3)" },
  { value: "Asia/Dubai", label: "Vereinigte Arabische Emirate (UTC+4)" },
  { value: "Asia/Karachi", label: "Pakistan (UTC+5)" },
] as const;

export function isKnownTimeZone(value: string) {
  return TIME_ZONE_OPTIONS.some((o) => o.value === value);
}

// Zeitzone einer Lehrkraft (null = deutsche Zeit).
export function teacherTimeZone(user: { timeZone?: string | null } | null | undefined) {
  return user?.timeZone && isKnownTimeZone(user.timeZone) ? user.timeZone : DEFAULT_TIME_ZONE;
}

export function timeZoneLabel(timeZone: string) {
  return TIME_ZONE_OPTIONS.find((o) => o.value === timeZone)?.label ?? timeZone;
}
