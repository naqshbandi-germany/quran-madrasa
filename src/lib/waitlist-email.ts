import { escapeHtml } from "@/lib/html";

const WRAPPER = (inner: string) => `
    <div style="font-family: sans-serif; color: #1d2a24; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #14325c; font-size: 20px;">Quran Madrasa</h1>
      ${inner}
    </div>
  `;

// Bestaetigung nach dem Eintragen in die Warteliste.
export function waitlistJoinedHtml(params: { name: string; courseTitle: string }) {
  return WRAPPER(`
      <p>Assalamu alaikum ${escapeHtml(params.name)},</p>
      <p>du stehst jetzt auf der Warteliste für den Kurs <strong>${escapeHtml(params.courseTitle)}</strong>.</p>
      <p>Sobald ein Platz frei wird, melden wir uns bei dir, auch für das nächste Semester.
      Eine Zahlung ist dafür nicht nötig.</p>
      <p style="font-size: 13px; color: #164a37;">Du hast diese Nachricht erhalten, weil du dich auf unserer
      Website in die Warteliste eingetragen hast.</p>`);
}

// Anfrage der Lehrkraft: Platz frei, besteht das Interesse noch?
export function waitlistOfferHtml(params: {
  name: string;
  courseTitle: string;
  teacherName: string;
  enrollUrl: string;
}) {
  return WRAPPER(`
      <p>Assalamu alaikum ${escapeHtml(params.name)},</p>
      <p>im Kurs <strong>${escapeHtml(params.courseTitle)}</strong> ist ein Platz frei geworden.
      Besteht weiterhin Interesse, dass du teilnimmst?</p>
      <p>Dann melde dich hier an:</p>
      <p><a href="${escapeHtml(params.enrollUrl)}" style="display: inline-block; padding: 10px 22px; background: #857348; color: #ffffff; text-decoration: none;">Zur Anmeldung</a></p>
      <p style="font-size: 13px; color: #164a37;">Der Platz wird nicht reserviert: Wer sich zuerst anmeldet,
      bekommt ihn. Wenn du kein Interesse mehr hast, brauchst du nichts zu tun.</p>
      <p>Viele Grüße<br>${escapeHtml(params.teacherName)}</p>`);
}

// Info an den Konto-Inhaber, wenn die Lehrkraft einen Teilnehmer aus dem Kurs entfernt hat.
export function participantRemovedHtml(params: {
  ownerName: string;
  participantName: string;
  courseTitle: string;
  subscriptionEnded: boolean;
}) {
  const billing = params.subscriptionEnded
    ? "Dein Abo für diesen Kurs wurde beendet."
    : "Dein Abo wurde um einen Teilnehmer verkleinert und wird ab der nächsten Abrechnung entsprechend berechnet.";
  return WRAPPER(`
      <p>Assalamu alaikum ${escapeHtml(params.ownerName)},</p>
      <p><strong>${escapeHtml(params.participantName)}</strong> wurde von der Lehrkraft aus dem Kurs
      <strong>${escapeHtml(params.courseTitle)}</strong> ausgetragen.</p>
      <p>${billing} Für den laufenden Monat erfolgt keine Rückerstattung.</p>
      <p style="font-size: 13px; color: #164a37;">Bei Fragen antworte einfach auf diese Nachricht.</p>`);
}
