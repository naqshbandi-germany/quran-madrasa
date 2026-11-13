import { formatGermanDateTime } from "@/lib/schedule-time";

// Die Texte der Erinnerungen stehen in src/lib/email-defaults.ts und sind im Admin-Bereich
// bearbeitbar; hier nur die Zuordnung Erinnerungsart -> Vorlage.

export type ReminderKind = "24h" | "1h" | "start";

export const REMINDER_TEMPLATES = {
  "24h": "reminder_24h",
  "1h": "reminder_1h",
  start: "reminder_start",
} as const;

export function formatReminderDate(date: Date) {
  return `${formatGermanDateTime(date, "full")} Uhr (deutsche Zeit)`;
}
