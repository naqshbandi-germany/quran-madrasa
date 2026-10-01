function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "full", timeStyle: "short" }).format(date);
}

export function reminderSubject(courseTitle: string, kind: "24h" | "1h") {
  return kind === "24h"
    ? `Erinnerung: "${courseTitle}" morgen`
    : `Gleich geht's los: "${courseTitle}" in einer Stunde`;
}

export function reminderHtml(params: {
  studentName: string;
  courseTitle: string;
  startsAt: Date;
  joinUrl: string;
  kind: "24h" | "1h";
}) {
  const { studentName, courseTitle, startsAt, joinUrl, kind } = params;
  const whenText = kind === "24h" ? "morgen" : "in einer Stunde";

  return `
    <div style="font-family: sans-serif; color: #1f3616; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #3f6b31; font-size: 20px;">Quran Madrasa</h1>
      <p>Assalamu alaikum ${studentName},</p>
      <p>
        kurze Erinnerung: dein Kurs <strong>${courseTitle}</strong> findet ${whenText} statt.
      </p>
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
