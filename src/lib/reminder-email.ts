import { escapeHtml } from "@/lib/html";
import { formatGermanDateTime } from "@/lib/schedule-time";

function formatDateTime(date: Date) {
  return `${formatGermanDateTime(date, "full")} Uhr (deutsche Zeit)`;
}

export type ReminderKind = "24h" | "1h" | "start";

export function reminderSubject(courseTitle: string, kind: ReminderKind) {
  switch (kind) {
    case "24h":
      return `Erinnerung: "${courseTitle}" morgen`;
    case "1h":
      return `Gleich geht's los: "${courseTitle}" in einer Stunde`;
    case "start":
      return `Jetzt live: "${courseTitle}" hat begonnen`;
  }
}

export function reminderHtml(params: {
  studentName: string;
  courseTitle: string;
  startsAt: Date;
  joinUrl: string;
  kind: ReminderKind;
}) {
  const { studentName, courseTitle, startsAt, joinUrl, kind } = params;
  const whenText =
    kind === "24h" ? "morgen" : kind === "1h" ? "in einer Stunde" : "gerade eben";
  const introText =
    kind === "start"
      ? `dein Kurs <strong>${courseTitle}</strong> hat gerade begonnen.`
      : `dein Kurs <strong>${courseTitle}</strong> findet ${whenText} statt.`;

  return `
    <div style="font-family: sans-serif; color: #1f3616; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #3f6b31; font-size: 20px;">Quran Madrasa</h1>
      <p>Assalamu alaikum ${escapeHtml(studentName)},</p>
      <p>${introText}</p>
      <p style="margin: 16px 0;">
        <strong>Wann:</strong> ${formatDateTime(startsAt)}
      </p>
      <p style="margin: 24px 0;">
        <a
          href="${joinUrl}"
          style="background: #3f6b31; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;"
        >
          Klasse beitreten
        </a>
      </p>
      <p style="font-size: 13px; color: #7aa968;">
        Diese Erinnerung wurde automatisch verschickt, weil du bei diesem Kurs eingeschrieben
        bist.
      </p>
    </div>
  `;
}
