import { escapeHtml } from "@/lib/html";
import { LINK_VALID_DAYS } from "@/lib/media";

export function materialEmailHtml(params: {
  studentName: string;
  courseTitle: string;
  message: string;
  attachmentNames?: string[];
  links?: { name: string; url: string }[];
}) {
  const { studentName, courseTitle, message, attachmentNames = [], links = [] } = params;
  const attachments =
    attachmentNames.length > 0
      ? `<p style="font-size: 13px; color: #1f3616;">Anhänge: ${attachmentNames.map(escapeHtml).join(", ")}</p>`
      : "";
  const linkList =
    links.length > 0
      ? `<p style="font-size: 13px; color: #1f3616;">Zum Herunterladen (Link ${LINK_VALID_DAYS} Tage gültig):</p><ul style="font-size: 13px;">${links
          .map((l) => `<li><a href="${escapeHtml(l.url)}">${escapeHtml(l.name)}</a></li>`)
          .join("")}</ul>`
      : "";

  return `
    <div style="font-family: sans-serif; color: #1f3616; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #3f6b31; font-size: 20px;">Quran Madrasa</h1>
      <p>Assalamu alaikum ${escapeHtml(studentName)},</p>
      <p style="font-size: 13px; color: #7aa968; margin-bottom: 4px;">
        Neue Nachricht zu deinem Kurs <strong>${courseTitle}</strong>:
      </p>
      <div style="white-space: pre-line; margin: 16px 0;">${escapeHtml(message)}</div>
      ${attachments}
      ${linkList}
      <p style="font-size: 13px; color: #7aa968;">
        Diese Nachricht wurde von deinem Lehrer verschickt, weil du bei diesem Kurs eingeschrieben
        bist.
      </p>
    </div>
  `;
}
