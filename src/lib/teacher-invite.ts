import { randomBytes } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { buildEmail } from "@/lib/email-templates";
import { hashResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, deliverEmail } from "@/lib/resend";

// Einladungslinks fuer Lehrkraefte sind laenger gueltig als normale Passwort-Links, weil
// die Lehrkraft die Mail vielleicht erst nach ein paar Tagen liest.
export const INVITE_TTL_DAYS = 7;

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

  const email = await buildEmail("teacher_invite", {
    name: user.name,
    email: user.email,
    link,
    tage: String(INVITE_TTL_DAYS),
  });

  // Lokal ohne Mail-Dienst: Link in der Konsole ausgeben (deliverEmail schreibt dann auch den
  // Text der Mail dorthin) und melden, dass nichts verschickt wurde.
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
    console.log(`[Lehrer-Einladung] ${user.email}: ${link}`);
    await deliverEmail({ from: EMAIL_FROM, to: user.email, ...email });
    return false;
  }

  await deliverEmail({ from: EMAIL_FROM, to: user.email, ...email });
  return true;
}
