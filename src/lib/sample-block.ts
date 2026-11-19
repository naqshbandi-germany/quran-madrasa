import { escapeHtml } from "@/lib/html";

// HTML-Baustein {{hoerprobe}}: Bitte um eine Hoerprobe mit Link zur Aufnahme (ohne Konto). Wird
// beim Versand und fuer die Vorschau im Browser verwendet und darf deshalb nichts
// Serverseitiges importieren.
export const SAMPLE_WHEN = {
  trial: "vor der Probestunde",
  invitation: "möglichst bald, gern schon vor der Anmeldung,",
} as const;

export function sampleBlockHtml(sampleRequest: string, url: string, when: string) {
  return `
      <div style="margin: 24px 0; padding: 12px 16px; background: #f4f1e8; border-left: 3px solid #b8963e;">
        <p style="margin: 0 0 8px;"><strong>Hörprobe erbeten:</strong> ${escapeHtml(sampleRequest)}</p>
        <p style="margin: 0 0 12px; font-size: 14px;">
          Bitte lies den Abschnitt ${when} laut vor und nimm ihn auf. Die Lehrkraft hört ihn
          sich an und kann sich so gezielt vorbereiten. Ein Konto brauchst du dafür nicht.
        </p>
        <a href="${escapeHtml(url)}" style="color: #1d6347; font-weight: bold;">Hörprobe aufnehmen</a>
      </div>`;
}
