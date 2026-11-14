import { randomBytes } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { buildEmail } from "@/lib/email-templates";
import { hashResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, deliverEmail } from "@/lib/resend";

// Einladungslinks fuer Lehrkraefte und Admins sind laenger gueltig als normale
// Passwort-Links, weil die Mail vielleicht erst nach ein paar Tagen gelesen wird.
export const INVITE_TTL_DAYS = 7;

export type InviteDelivery = "mail" | "link";

// Ergebnis: Der Link (fuer die Variante "per Link", z. B. zum Weitergeben per WhatsApp) und
// ob eine Mail rausging (lokal ohne Mail-Dienst: false, der Link steht dann in der Konsole).
export type AccountInviteResult = { link: string; mailed: boolean };

// Legt fuer ein Lehrer- oder Admin-Konto einen Einladungslink an, ueber den die Person ihr
// eigenes Passwort festlegt. Aeltere, noch offene Links des Kontos werden dabei entwertet.
// Bei delivery "mail" wird der Link zusaetzlich per E-Mail verschickt.
export async function createAccountInvite(
  userId: string,
  delivery: InviteDelivery = "mail",
): Promise<AccountInviteResult> {
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
  if (delivery === "link") return { link, mailed: false };

  const email = await buildEmail(user.role === "ADMIN" ? "admin_invite" : "teacher_invite", {
    name: user.name,
    email: user.email,
    link,
    tage: String(INVITE_TTL_DAYS),
  });

  await deliverEmail({ from: EMAIL_FROM, to: user.email, ...email });
  // Lokal ohne Mail-Dienst schreibt deliverEmail die Mail nur in die Konsole.
  const mailed = Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV === "production";
  if (!mailed) console.log(`[Einladung] ${user.email}: ${link}`);
  return { link, mailed };
}
