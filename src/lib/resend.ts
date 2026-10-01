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
