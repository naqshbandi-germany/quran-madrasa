import { escapeHtml } from "@/lib/html";
import { formatGermanDateTime } from "@/lib/schedule-time";

// Die Texte der Erinnerungen stehen in src/lib/email-defaults.ts und sind im Admin-Bereich
// bearbeitbar; hier nur die Zuordnung Erinnerungsart -> Vorlage und vom Code erzeugte Bausteine.

export type ReminderKind = "24h" | "1h" | "start";

export const REMINDER_TEMPLATES = {
  "24h": "reminder_24h",
  "1h": "reminder_1h",
  start: "reminder_start",
} as const;

export function formatReminderDate(date: Date) {
  return `${formatGermanDateTime(date, "full")} Uhr (deutsche Zeit)`;
}

// Hinweis auf eine von der Lehrkraft erbetene Leseprobe (Platzhalter {{leseprobe}} in der
// Erinnerung 24 Stunden vorher). Ohne Bitte bleibt er leer.
export function readingRequestHtml(readingRequest: string | null | undefined, readingUrl: string) {
  if (!readingRequest) return "";
  return `
      <div style="margin: 24px 0; padding: 12px 16px; background: #f4f1e8; border-left: 3px solid #b8963e;">
        <p style="margin: 0 0 8px;"><strong>Leseprobe erbeten:</strong> ${escapeHtml(readingRequest)}</p>
        <p style="margin: 0 0 12px; font-size: 14px;">
          Bitte nimm den Abschnitt vor der Stunde kurz auf. Die Lehrkraft hört ihn sich an und kann
          sich so gezielt vorbereiten. Nur die Lehrkraft kann die Aufnahme hören.
        </p>
        <a href="${escapeHtml(readingUrl)}" style="color: #1d6347; font-weight: bold;">Leseprobe aufnehmen</a>
      </div>`;
}
