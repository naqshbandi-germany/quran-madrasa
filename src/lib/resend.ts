import { Resend } from "resend";

// Lazy statt eager erzeugt, siehe Kommentar in src/lib/stripe.ts.
let resendInstance: Resend | null = null;

export function getResend() {
  if (!resendInstance) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY ist nicht gesetzt (siehe .env.example)");
    }
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

// z.B. "Quran Madrasa <meeting@islamunterfreunden.de>" - die Domain muss bei
// Resend verifiziert sein (siehe README).
export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

// Eigener Absender fuer Kursmaterial-Mails vom Lehrer an die Kursteilnehmer, getrennt
// von EMAIL_FROM (automatische Sitzungs-Erinnerungen), damit Schueler beide Arten von
// Mails unterscheiden koennen. Faellt auf EMAIL_FROM zurueck, falls nicht gesetzt.
export const MATERIAL_EMAIL_FROM = process.env.RESEND_MATERIAL_FROM_EMAIL || EMAIL_FROM;

type OutgoingEmail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
};

// Verschickt eine E-Mail ueber Resend und wirft bei einem Fehler. Ohne RESEND_API_KEY wird
// ausserhalb der Produktion nichts versendet, sondern nur in die Konsole geschrieben (lokale
// Entwicklung).
export async function deliverEmail(email: OutgoingEmail) {
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
    const files = (email.attachments ?? []).map((a) => `${a.filename} (${a.content.length} B)`);
    console.log(`[E-Mail nicht gesendet, kein RESEND_API_KEY] an ${email.to}: ${email.subject}`, files);
    return;
  }
  const { error } = await getResend().emails.send(email);
  if (error) throw new Error(error.message);
}
