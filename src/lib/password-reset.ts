import { createHash, randomBytes } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, getResend } from "@/lib/resend";

export const RESET_TOKEN_TTL_MINUTES = 60;
// Pro Konto hoechstens alle 60 Sekunden ein neuer Link (gegen E-Mail-Flut)
const RESET_COOLDOWN_SECONDS = 60;

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function resetEmailHtml(name: string, link: string) {
  return `
    <div style="font-family: sans-serif; color: #1d2a24; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #14325c; font-size: 20px;">Quran Madrasa</h1>
      <p>Assalamu alaikum ${name},</p>
      <p>du hast darum gebeten, dein Passwort zurückzusetzen. Mit diesem Link legst du ein neues
      Passwort fest. Er ist ${RESET_TOKEN_TTL_MINUTES} Minuten gültig und nur einmal nutzbar:</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background: #1d6347; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Neues Passwort festlegen
        </a>
      </p>
      <p style="font-size: 13px; color: #5b6470;">
        Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren; dein Passwort
        bleibt dann unverändert.
      </p>
    </div>
  `;
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

  // Lokal ohne E-Mail-Dienst: Link in der Konsole ausgeben, damit sich der Ablauf testen laesst.
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
    console.log(`[Passwort zuruecksetzen] ${user.email}: ${link}`);
    return;
  }

  try {
    await getResend().emails.send({
      from: EMAIL_FROM,
      to: user.email,
      subject: "Passwort zurücksetzen",
      html: resetEmailHtml(user.name, link),
    });
  } catch (err) {
    console.error("Passwort-Reset-E-Mail konnte nicht gesendet werden:", err);
  }
}
