import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  throw new Error("RESEND_API_KEY ist nicht gesetzt (siehe .env.example)");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

// z.B. "Quran Madrasa <erinnerung@islamunterfreunden.de>" - die Domain muss bei
// Resend verifiziert sein (siehe README).
export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
