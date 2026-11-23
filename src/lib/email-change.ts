import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { buildEmail } from "@/lib/email-templates";
import { callName } from "@/lib/names";
import { hashResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, deliverEmail } from "@/lib/resend";
import { getStripe } from "@/lib/stripe";

// Aendern der Anmelde-Adresse: Der Link geht an die NEUE Adresse (Nachweis, dass sie der Person
// gehoert), erst beim Bestaetigen wird umgestellt. Die alte Adresse bekommt danach einen Hinweis.
export const EMAIL_CHANGE_TTL_MINUTES = 60;
const COOLDOWN_SECONDS = 60;

type Account = { id: string; name: string; muslimName: string | null; email: string };

export type EmailChangeRequest = "sent" | "taken" | "too-soon" | "mail-failed";

export async function requestEmailChange(user: Account, newEmail: string): Promise<EmailChangeRequest> {
  const taken = await prisma.user.findFirst({
    where: { email: { equals: newEmail, mode: "insensitive" }, id: { not: user.id } },
    select: { id: true },
  });
  if (taken) return "taken";

  const open = await prisma.emailChangeToken.findUnique({ where: { userId: user.id } });
  if (open && open.createdAt.getTime() > Date.now() - COOLDOWN_SECONDS * 1000) return "too-soon";

  const token = randomBytes(32).toString("hex");
  const data = {
    newEmail,
    tokenHash: hashResetToken(token),
    expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MINUTES * 60_000),
    createdAt: new Date(),
  };
  // Pro Konto nur ein offener Link, ein neuer ersetzt den alten.
  await prisma.emailChangeToken.upsert({
    where: { userId: user.id },
    create: { userId: user.id, ...data },
    update: data,
  });

  const link = `${getAppUrl()}/auth/email-bestaetigen?token=${token}`;
  if (!process.env.RESEND_API_KEY && process.env.NODE_ENV !== "production") {
    console.log(`[E-Mail aendern] ${newEmail}: ${link}`);
  }
  try {
    await deliverEmail({
      from: EMAIL_FROM,
      to: newEmail,
      ...(await buildEmail("email_change_confirm", {
        name: callName(user),
        link,
        minuten: String(EMAIL_CHANGE_TTL_MINUTES),
      })),
    });
  } catch (err) {
    console.error("Bestätigungs-Mail zur Adressänderung konnte nicht gesendet werden:", err);
    await prisma.emailChangeToken.deleteMany({ where: { userId: user.id } });
    return "mail-failed";
  }
  return "sent";
}

export async function findEmailChange(token: string | null | undefined) {
  if (!token || token.length > 200) return null;
  const record = await prisma.emailChangeToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { id: true, name: true, muslimName: true, email: true, stripeCustomerId: true } } },
  });
  return record && record.expiresAt > new Date() ? record : null;
}

export async function confirmEmailChange(token: string): Promise<"changed" | "invalid" | "taken"> {
  const record = await findEmailChange(token);
  if (!record) return "invalid";
  const { user, newEmail } = record;

  try {
    const done = await prisma.$transaction(async (tx) => {
      // Link genau einmal einloesen (auch bei zwei gleichzeitigen Klicks).
      const claimed = await tx.emailChangeToken.deleteMany({ where: { id: record.id, tokenHash: record.tokenHash } });
      if (claimed.count === 0) return false;
      await tx.user.update({ where: { id: user.id }, data: { email: newEmail } });
      // Der Teilnehmer "Du selbst" folgt der Adresse des Kontos.
      await tx.participant.updateMany({ where: { ownerId: user.id, relation: "SELF" }, data: { email: newEmail } });
      // Links, die an die alte Adresse gingen, entwerten.
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      return true;
    });
    if (!done) return "invalid";
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return "taken";
    throw err;
  }

  // Nebenwirkungen duerfen die Aenderung nicht mehr scheitern lassen.
  if (user.stripeCustomerId) {
    try {
      await getStripe().customers.update(user.stripeCustomerId, { email: newEmail });
    } catch (err) {
      console.error("Stripe: Adresse des Kunden konnte nicht geändert werden:", err);
    }
  }
  try {
    await deliverEmail({
      from: EMAIL_FROM,
      to: user.email,
      ...(await buildEmail("email_changed", { name: callName(user), neu: newEmail })),
    });
  } catch (err) {
    console.error("Hinweis an die alte Adresse konnte nicht gesendet werden:", err);
  }
  return "changed";
}
