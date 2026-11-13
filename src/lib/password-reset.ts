import { createHash, randomBytes } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { buildEmail } from "@/lib/email-templates";
import { EMAIL_FROM, deliverEmail } from "@/lib/resend";

export const RESET_TOKEN_TTL_MINUTES = 60;
// Pro Konto hoechstens alle 60 Sekunden ein neuer Link (gegen E-Mail-Flut)
const RESET_COOLDOWN_SECONDS = 60;

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

// Legt (falls es das Konto gibt) einen Link an und verschickt ihn. Das Ergebnis ist fuer
// den Aufrufer immer gleich, damit sich nicht erraten laesst, welche E-Mail-Adressen
// registriert sind.
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return;

  const recent = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      createdAt: { gt: new Date(Date.now() - RESET_COOLDOWN_SECONDS * 1000) },
    },
  });
  if (recent) return;

  const token = randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashResetToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
    },
  });

  const link = `${getAppUrl()}/auth/passwort-zuruecksetzen?token=${token}`;

  // Lokal ohne E-Mail-Dienst: Link in der Konsole ausgeben, damit sich der Ablauf testen laesst
  // (deliverEmail schreibt die Mail selbst dann ebenfalls nur in die Konsole).
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
    console.log(`[Passwort zuruecksetzen] ${user.email}: ${link}`);
  }

  try {
    await deliverEmail({
      from: EMAIL_FROM,
      to: user.email,
      ...(await buildEmail("password_reset", {
        name: user.name,
        link,
        minuten: String(RESET_TOKEN_TTL_MINUTES),
      })),
    });
  } catch (err) {
    console.error("Passwort-Reset-E-Mail konnte nicht gesendet werden:", err);
  }
}
