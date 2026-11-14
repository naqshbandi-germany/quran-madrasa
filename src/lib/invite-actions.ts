"use server";

import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { createStudentInvitation, STUDENT_INVITE_TTL_DAYS } from "@/lib/invitations";
import { prisma } from "@/lib/prisma";
import { createAccountInvite, INVITE_TTL_DAYS, type InviteDelivery } from "@/lib/teacher-invite";

export type InviteState = {
  ok: boolean;
  message: string;
  // Bei Erfolg: Link zum Kopieren und ein fertiger Text zum Weiterschicken (z. B. WhatsApp)
  link?: string;
  shareText?: string;
} | null;

function delivery(formData: FormData): InviteDelivery {
  return formData.get("delivery") === "link" ? "link" : "mail";
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function successMessage(mode: InviteDelivery, mailed: boolean, email: string | null) {
  if (mode === "link") return "Der Einladungslink ist erstellt. Kopiere ihn und schicke ihn selbst weiter, z. B. per WhatsApp.";
  if (mailed) return `Die Einladung wurde per E-Mail an ${email} verschickt.`;
  return "Kein E-Mail-Dienst eingerichtet (lokal): Die Mail steht in der Server-Konsole. Du kannst den Link auch hier kopieren.";
}

const ROLE_LABEL: Record<"TEACHER" | "ADMIN", string> = { TEACHER: "Lehrer", ADMIN: "Admin" };

function staffShareText(name: string, role: "TEACHER" | "ADMIN", link: string) {
  return `Salam alaykum ${name}, für dich wurde ein ${ROLE_LABEL[role]}-Zugang bei Islam unter Freunden angelegt. Über diesen Link legst du dein Passwort fest (${INVITE_TTL_DAYS} Tage gültig): ${link}`;
}

const staffSchema = z.object({
  name: z.string().trim().min(2, "Bitte einen Namen angeben."),
  email: z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben."),
  role: z.enum(["TEACHER", "ADMIN"]),
});

// Admin legt einen Lehrer- oder Admin-Zugang an und laedt per E-Mail oder Link ein. Das
// Passwort legt die Person selbst fest; bis dahin ist das Konto mit einem unbekannten
// Zufallspasswort gesperrt.
export async function inviteStaff(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const session = await auth();
  if (session?.user.role !== Role.ADMIN) return { ok: false, message: "Nicht berechtigt." };

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  const { name, email, role } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return {
      ok: false,
      message:
        "Zu dieser E-Mail-Adresse gibt es schon ein Konto (z. B. als Schüler). Bitte eine andere E-Mail-Adresse verwenden.",
    };
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const user = await prisma.user.create({ data: { name, email, passwordHash, role } });
  revalidatePath("/admin");

  const mode = delivery(formData);
  try {
    const { link, mailed } = await createAccountInvite(user.id, mode);
    return { ok: true, message: successMessage(mode, mailed, email), link, shareText: staffShareText(name, role, link) };
  } catch (err) {
    console.error("Einladung konnte nicht verschickt werden:", err);
    return {
      ok: false,
      message: "Der Zugang ist angelegt, aber die E-Mail konnte nicht verschickt werden. Bitte „Einladung erneut senden“ oder einen Link erstellen.",
    };
  }
}

// Neuer Einladungslink fuer ein bestehendes Lehrer- oder Admin-Konto (z. B. abgelaufen,
// E-Mail-Adresse geaendert oder Weitergabe per WhatsApp gewuenscht).
export async function resendStaffInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const session = await auth();
  if (session?.user.role !== Role.ADMIN) return { ok: false, message: "Nicht berechtigt." };

  const userId = text(formData, "userId");
  const user = await prisma.user.findFirst({
    where: { id: userId, role: { in: [Role.TEACHER, Role.ADMIN] } },
  });
  if (!user) return { ok: false, message: "Konto nicht gefunden." };
  const role = user.role === Role.ADMIN ? "ADMIN" : "TEACHER";

  const mode = delivery(formData);
  try {
    const { link, mailed } = await createAccountInvite(user.id, mode);
    return { ok: true, message: successMessage(mode, mailed, user.email), link, shareText: staffShareText(user.name, role, link) };
  } catch (err) {
    console.error("Einladung konnte nicht verschickt werden:", err);
    return { ok: false, message: "Die E-Mail konnte nicht verschickt werden. Erstelle stattdessen einen Link." };
  }
}

const studentSchema = z.object({
  courseId: z.string().min(1, "Bitte einen Kurs wählen."),
  name: z.string().trim().max(100),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben.")]),
});

// Laedt jemanden zu einem Kurs ein. Lehrkraefte nur zu eigenen Kursen und immer zur normalen
// Anmeldung mit Bezahlung; Admins koennen zusaetzlich "ohne Zahlung eintragen" waehlen.
export async function inviteStudent(_prev: InviteState, formData: FormData): Promise<InviteState> {
  const session = await auth();
  if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.TEACHER)) {
    return { ok: false, message: "Nicht berechtigt." };
  }
  const isAdmin = session.user.role === Role.ADMIN;

  const parsed = studentSchema.safeParse({
    courseId: formData.get("courseId") ?? "",
    name: formData.get("name") ?? "",
    email: formData.get("email") ?? "",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };
  const { courseId, name, email } = parsed.data;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || (!isAdmin && course.teacherId !== session.user.id)) {
    return { ok: false, message: "Kurs nicht gefunden." };
  }
  if (!course.isPublished) {
    return { ok: false, message: "Der Kurs ist noch nicht veröffentlicht. Bitte erst veröffentlichen, dann einladen." };
  }

  const freeEnrollment = isAdmin && formData.get("free") === "on";
  if (!freeEnrollment && !course.stripePriceId) {
    return { ok: false, message: "Für diesen Kurs ist noch kein Stripe-Preis hinterlegt, eine Anmeldung mit Bezahlung ist nicht möglich." };
  }

  const mode = delivery(formData);
  if (mode === "mail" && (!email || name.length < 2)) {
    return { ok: false, message: "Für den Versand per E-Mail bitte Name und E-Mail-Adresse angeben." };
  }

  try {
    const { link, mailed } = await createStudentInvitation({
      courseId,
      invitedById: session.user.id,
      name: name || null,
      email: email || null,
      freeEnrollment,
      delivery: mode,
    });
    const greeting = name ? `Salam alaykum ${name}, ` : "Salam alaykum, ";
    const shareText = `${greeting}hier ist deine Einladung zum Kurs „${course.title}“ bei Islam unter Freunden${freeEnrollment ? " (für dich kostenlos)" : ""}. Der Link ist ${STUDENT_INVITE_TTL_DAYS} Tage gültig: ${link}`;
    return {
      ok: true,
      message: `${successMessage(mode, mailed, email || null)}${freeEnrollment ? " Die Anmeldung erfolgt ohne Zahlung (einmal nutzbar)." : ""}`,
      link,
      shareText,
    };
  } catch (err) {
    console.error("Kurs-Einladung fehlgeschlagen:", err);
    return { ok: false, message: "Die Einladung konnte nicht verschickt werden. Erstelle stattdessen einen Link." };
  }
}
