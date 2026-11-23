import { randomBytes } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { accessQuery } from "@/lib/course-access";
import { STUDENT_INVITE_HINTS } from "@/lib/email-defaults";
import { buildEmail, type EmailContentOptions } from "@/lib/email-templates";
import { hashResetToken } from "@/lib/password-reset";
import { callName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, deliverEmail } from "@/lib/resend";
import type { InviteDelivery } from "@/lib/teacher-invite";
import { invitationSampleHtml, invitationSampleShareText, invitationSampleToken } from "@/lib/trial-samples";

// Einladungen von Schuelern zu einem Kurs (per E-Mail oder als Link zum Weitergeben).
export const STUDENT_INVITE_TTL_DAYS = 14;

export function invitationPath(token: string) {
  return `/einladung/${token}`;
}

// Gekuerzte Adresse fuer Hinweise ("f…@gmail.com"), falls ein Link weitergeleitet wurde.
export function shortenEmail(email: string) {
  const at = email.lastIndexOf("@");
  return at > 0 ? `${email[0]}…${email.slice(at)}` : "eine andere Adresse";
}

export async function createStudentInvitation(params: {
  courseId: string;
  invitedById: string;
  name: string | null;
  email: string | null;
  freeEnrollment: boolean;
  delivery: InviteDelivery;
  // Erbetene Hoerprobe, z. B. "Sure 67 Al-Mulk, Verse 1–10" (persoenlicher Link ohne Konto)
  sampleRequest?: string | null;
  // Probestunden-Gast, der hier eingeladen wird
  trialGuestId?: string | null;
  // Text der Mail (eigene Vorlage bzw. fuer diesen Versand angepasst)
  emailOptions?: EmailContentOptions;
}): Promise<{ link: string; mailed: boolean; sampleShareText: string }> {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: params.courseId } });
  const inviter = await prisma.user.findUniqueOrThrow({ where: { id: params.invitedById } });

  const token = randomBytes(24).toString("base64url");
  const invitation = await prisma.invitation.create({
    data: {
      tokenHash: hashResetToken(token),
      courseId: course.id,
      name: params.name,
      email: params.email,
      freeEnrollment: params.freeEnrollment,
      invitedById: inviter.id,
      sampleRequest: params.sampleRequest || null,
      trialGuestId: params.trialGuestId || null,
      expiresAt: new Date(Date.now() + STUDENT_INVITE_TTL_DAYS * 24 * 3600 * 1000),
    },
    select: { id: true },
  });

  const link = `${getAppUrl()}${invitationPath(token)}`;
  const sampleToken = params.sampleRequest ? invitationSampleToken(invitation.id) : null;
  const sampleShareText = invitationSampleShareText(params.sampleRequest, sampleToken);
  if (params.delivery === "link" || !params.email) return { link, mailed: false, sampleShareText };

  const email = await buildEmail(
    "student_invite",
    {
      name: params.name ?? "",
      kurs: course.title,
      von: callName(inviter),
      hinweis: params.freeEnrollment ? STUDENT_INVITE_HINTS.free : STUDENT_INVITE_HINTS.paid,
      link,
      tage: String(STUDENT_INVITE_TTL_DAYS),
      hoerprobe: invitationSampleHtml(params.sampleRequest, sampleToken),
    },
    params.emailOptions,
  );
  await deliverEmail({ from: EMAIL_FROM, to: params.email, ...email });
  const mailed = Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV === "production";
  if (!mailed) console.log(`[Kurs-Einladung] ${params.email}: ${link}`);
  return { link, mailed, sampleShareText };
}

// Liefert die Einladung zu einem Token, falls sie noch gilt. Einladungen ohne Zahlung sind nur
// einmal nutzbar; die normale Einladung (mit Zahlung) gilt bis zum Ablauf.
export async function findValidInvitation(token: string | null | undefined) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: {
      course: true,
      invitedBy: { select: { name: true, muslimName: true } },
    },
  });
  if (!invitation || invitation.expiresAt < new Date()) return null;
  if (invitation.freeEnrollment && invitation.usedAt) return null;
  return invitation;
}

// Pfad zur Kursanmeldung mit Einladung (bei versteckten Kursen inklusive Zugangscode).
export function enrollPathForInvitation(
  course: { slug: string; isHidden: boolean; accessCode: string | null },
  token: string,
) {
  const query = accessQuery(course);
  return `/courses/${course.slug}/anmelden${query ? `${query}&` : "?"}einladung=${encodeURIComponent(token)}`;
}
