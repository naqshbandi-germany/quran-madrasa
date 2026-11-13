import { randomBytes } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { hashResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, getResend } from "@/lib/resend";

// Einladungslinks fuer Lehrkraefte sind laenger gueltig als normale Passwort-Links, weil
// die Lehrkraft die Mail vielleicht erst nach ein paar Tagen liest.
export const INVITE_TTL_DAYS = 7;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function inviteEmailHtml(name: string, email: string, link: string) {
  return `
    <div style="font-family: sans-serif; color: #1d2a24; max-width: 480px; margin: 0 auto;">
      <h1 style="color: #14325c; font-size: 20px;">Quran Madrasa</h1>
      <p>Assalamu alaykum ${escapeHtml(name)},</p>
      <p>für dich wurde ein Lehrer-Zugang bei Quran Madrasa angelegt. Dein Benutzername ist
      deine E-Mail-Adresse <strong>${escapeHtml(email)}</strong>.</p>
      <p>Bitte lege über diesen Link dein eigenes Passwort fest. Der Link ist ${INVITE_TTL_DAYS} Tage
      gültig und nur einmal nutzbar:</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background: #1d6347; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">
          Passwort festlegen
        </a>
      </p>
      <p>Danach meldest du dich mit deiner E-Mail-Adresse und dem neuen Passwort an und findest
      unter „Meine Kurse“ deine Kurse.</p>
      <p style="font-size: 13px; color: #5b6470;">
        Ist der Link abgelaufen, kannst du auf der Anmeldeseite über „Passwort vergessen?“
        jederzeit einen neuen anfordern.
      </p>
    </div>
  `;
}

// Legt einen Einladungslink an und verschickt ihn. Aeltere, noch offene Links des Kontos
// werden dabei entwertet. Gibt zurueck, ob die Mail rausging (lokal ohne Mail-Dienst: false,
// der Link steht dann in der Server-Konsole).
export async function sendTeacherInvite(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const token = randomBytes(32).toString("hex");
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000),
      },
    }),
  ]);

  const link = `${getAppUrl()}/auth/passwort-zuruecksetzen?token=${token}&einladung=1`;

  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
    console.log(`[Lehrer-Einladung] ${user.email}: ${link}`);
    return false;
  }

  await getResend().emails.send({
    from: EMAIL_FROM,
    to: user.email,
    subject: "Dein Lehrer-Zugang bei Quran Madrasa",
    html: inviteEmailHtml(user.name, user.email, link),
  });
  return true;
}
