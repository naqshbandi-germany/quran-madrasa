import { randomBytes } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { accessQuery } from "@/lib/course-access";
import { buildEmail } from "@/lib/email-templates";
import { hashResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, deliverEmail } from "@/lib/resend";
import type { InviteDelivery } from "@/lib/teacher-invite";

// Einladungen von Schuelern zu einem Kurs (per E-Mail oder als Link zum Weitergeben).
export const STUDENT_INVITE_TTL_DAYS = 14;

export function invitationPath(token: string) {
  return `/einladung/${token}`;
}

export async function createStudentInvitation(params: {
  courseId: string;
  invitedById: string;
  name: string | null;
  email: string | null;
  freeEnrollment: boolean;
  delivery: InviteDelivery;
}): Promise<{ link: string; mailed: boolean }> {
  const course = await prisma.course.findUniqueOrThrow({ where: { id: params.courseId } });
  const inviter = await prisma.user.findUniqueOrThrow({ where: { id: params.invitedById } });

  const token = randomBytes(24).toString("base64url");
  await prisma.invitation.create({
    data: {
      tokenHash: hashResetToken(token),
      courseId: course.id,
      name: params.name,
      email: params.email,
      freeEnrollment: params.freeEnrollment,
      invitedById: inviter.id,
      expiresAt: new Date(Date.now() + STUDENT_INVITE_TTL_DAYS * 24 * 3600 * 1000),
    },
  });

  const link = `${getAppUrl()}${invitationPath(token)}`;
  if (params.delivery === "link" || !params.email) return { link, mailed: false };

  const email = await buildEmail("student_invite", {
    name: params.name ?? "",
    kurs: course.title,
    von: inviter.name,
    hinweis: params.freeEnrollment
      ? "Die Teilnahme ist für dich kostenlos."
      : "Die Anmeldung und Bezahlung erledigst du direkt über den Link.",
    link,
    tage: String(STUDENT_INVITE_TTL_DAYS),
  });
  await deliverEmail({ from: EMAIL_FROM, to: params.email, ...email });
  const mailed = Boolean(process.env.RESEND_API_KEY) || process.env.NODE_ENV === "production";
  if (!mailed) console.log(`[Kurs-Einladung] ${params.email}: ${link}`);
  return { link, mailed };
}

// Liefert die Einladung zu einem Token, falls sie noch gilt. Einladungen ohne Zahlung sind nur
// einmal nutzbar; die normale Einladung (mit Zahlung) gilt bis zum Ablauf.
export async function findValidInvitation(token: string | null | undefined) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: {
      course: true,
      invitedBy: { select: { name: true } },
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
