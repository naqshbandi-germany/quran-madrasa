import { escapeHtml } from "@/lib/html";

export function materialEmailHtml(params: { studentName: string; courseTitle: string; message: string }) {
  const { studentName, courseTitle, message } = params;

  return `
    <div style="font-family: sans-serif; color: #1f3616; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #3f6b31; font-size: 20px;">Quran Madrasa</h1>
      <p>Assalamu alaikum ${escapeHtml(studentName)},</p>
      <p style="font-size: 13px; color: #7aa968; margin-bottom: 4px;">
        Neue Nachricht zu deinem Kurs <strong>${courseTitle}</strong>:
      </p>
      <div style="white-space: pre-line; margin: 16px 0;">${escapeHtml(message)}</div>
      <p style="font-size: 13px; color: #7aa968;">
        Diese Nachricht wurde von deinem Lehrer verschickt, weil du bei diesem Kurs eingeschrieben
        bist.
      </p>
    </div>
  `;
}
