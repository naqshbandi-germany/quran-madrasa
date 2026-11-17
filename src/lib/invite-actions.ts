"use server";

import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { createStudentInvitation, STUDENT_INVITE_TTL_DAYS } from "@/lib/invitations";
import { enrolledEmails, lookupInvitee, normalizeEmail, type KnownInvitee } from "@/lib/invitees";
import { prisma } from "@/lib/prisma";
import { formatZonedDateTime, parseZonedDateTime } from "@/lib/schedule-time";
import { resolveViewTimeZone } from "@/lib/view-time-zone";
import { addTrialGuests, createTrialLesson, TRIAL_DURATIONS } from "@/lib/trial-lessons";
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

const studentEntrySchema = z.object({
  name: z.string().trim().max(100),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse angeben.")]),
});

export type StudentInviteResult = {
  name: string;
  email: string;
  ok: boolean;
  message: string;
  link?: string;
  shareText?: string;
};

export type StudentInviteState = {
  ok: boolean;
  message: string;
  results?: StudentInviteResult[];
} | null;

const MAX_STUDENTS_PER_INVITE = 50;

// Abfrage beim Eintippen einer E-Mail-Adresse im Einladungsformular: Ist die Person schon
// bekannt (Konto, offene Einladung, Probestunde)?
export async function lookupInviteEmail(email: string, courseId: string): Promise<KnownInvitee | null> {
  const session = await auth();
  if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.TEACHER)) return null;
  const parsed = z.string().trim().email().max(200).safeParse(email);
  if (!parsed.success) return null;
  const { timeZone } = await resolveViewTimeZone(session.user.id);
  return lookupInvitee({
    email: parsed.data,
    courseId: courseId || null,
    viewer: { id: session.user.id, isAdmin: session.user.role === Role.ADMIN },
    timeZone,
  });
}

// Laedt einen oder mehrere Schueler zu einem Kurs ein (Feld "students" als JSON-Liste mit
// name und email). Lehrkraefte nur zu eigenen Kursen und immer zur normalen Anmeldung mit
// Bezahlung; Admins koennen zusaetzlich "ohne Zahlung eintragen" waehlen. Ohne Eintrag wird
// bei "Link erstellen" ein Link ohne Namen erzeugt.
export async function inviteStudents(_prev: StudentInviteState, formData: FormData): Promise<StudentInviteState> {
  const session = await auth();
  if (!session || (session.user.role !== Role.ADMIN && session.user.role !== Role.TEACHER)) {
    return { ok: false, message: "Nicht berechtigt." };
  }
  const isAdmin = session.user.role === Role.ADMIN;

  const courseId = text(formData, "courseId");
  if (!courseId) return { ok: false, message: "Bitte einen Kurs wählen." };
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || (!isAdmin && course.teacherId !== session.user.id)) {
    return { ok: false, message: "Kurs nicht gefunden." };
  }
  if (!course.isPublished) {
    return { ok: false, message: "Der Kurs ist noch nicht veröffentlicht. Bitte erst veröffentlichen, dann einladen." };
  }

  const isTrial = formData.get("trial") === "on";
  const freeEnrollment = !isTrial && isAdmin && formData.get("free") === "on";
  if (!isTrial && !freeEnrollment && !course.stripePriceId) {
    return { ok: false, message: "Für diesen Kurs ist noch kein Stripe-Preis hinterlegt, eine Anmeldung mit Bezahlung ist nicht möglich." };
  }

  let raw: unknown = [];
  try {
    raw = JSON.parse(text(formData, "students") || "[]");
  } catch {
    return { ok: false, message: "Ungültige Eingaben." };
  }
  const parsed = z.array(studentEntrySchema).max(MAX_STUDENTS_PER_INVITE, `Höchstens ${MAX_STUDENTS_PER_INVITE} Schüler auf einmal.`).safeParse(raw);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Ungültige Eingaben." };

  const mode = delivery(formData);
  // Dieselbe E-Mail-Adresse nur einmal (z. B. versehentlich doppelt in der Liste).
  const seen = new Set<string>();
  const students = parsed.data.filter((s) => {
    if (!s.name && !s.email) return false;
    if (!s.email) return true;
    const key = normalizeEmail(s.email);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (students.length === 0) {
    if (mode === "mail") return { ok: false, message: "Bitte mindestens einen Schüler mit Name und E-Mail-Adresse eingeben." };
    students.push({ name: "", email: "" });
  }
  if (mode === "mail") {
    const missing = students.find((s) => !s.email || s.name.length < 2);
    if (missing) {
      return {
        ok: false,
        message: `Für den Versand per E-Mail braucht jeder Schüler Name und E-Mail-Adresse (fehlt bei „${missing.name || missing.email}“).`,
      };
    }
  }

  if (isTrial) return inviteToTrial(session.user.id, course.id, students, mode, formData);

  const enrolled = await enrolledEmails(course.id);
  const results: StudentInviteResult[] = [];
  for (const { name, email } of students) {
    if (email && enrolled.has(normalizeEmail(email))) {
      results.push({ name, email, ok: false, message: "Ist bereits in diesem Kurs angemeldet, keine Einladung nötig." });
      continue;
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
      results.push({
        name,
        email,
        ok: true,
        message: successMessage(mode, mailed, email || null),
        link,
        shareText: `${greeting}hier ist deine Einladung zum Kurs „${course.title}“ bei Islam unter Freunden${freeEnrollment ? " (für dich kostenlos)" : ""}. Der Link ist ${STUDENT_INVITE_TTL_DAYS} Tage gültig: ${link}`,
      });
    } catch (err) {
      console.error("Kurs-Einladung fehlgeschlagen:", err);
      results.push({ name, email, ok: false, message: "Die Einladung konnte nicht verschickt werden. Erstelle stattdessen einen Link." });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  const free = freeEnrollment ? " Die Anmeldung erfolgt ohne Zahlung (jeder Link einmal nutzbar)." : "";
  let message: string;
  if (results.length === 1) message = `${results[0].message}${results[0].ok ? free : ""}`;
  else if (mode === "link") message = `${okCount} von ${results.length} Einladungslinks erstellt. Kopiere sie und schicke sie selbst weiter, z. B. per WhatsApp.${free}`;
  else message = `${okCount} von ${results.length} Einladungen verschickt.${free}`;
  return { ok: okCount > 0, message, results };
}

// Probestunde: ein gemeinsamer Termin fuer alle Eingeladenen. Die Uhrzeit gilt in der Zeitzone,
// in der der Lehrer-Bereich gerade anzeigt.
async function inviteToTrial(
  userId: string,
  courseId: string,
  students: { name: string; email: string }[],
  mode: InviteDelivery,
  formData: FormData,
): Promise<StudentInviteState> {
  if (students.some((s) => s.name.length < 2)) {
    return { ok: false, message: "Für die Probestunde braucht jeder Eingeladene einen Namen." };
  }
  // Gleiche Zeitzone wie die Anzeige im Lehrer-Bereich (eigene Zeitzone oder per Schalter MEZ).
  const { timeZone } = await resolveViewTimeZone(userId);

  // Bestehende Probestunde gewaehlt: weitere Gaeste zum selben Termin einladen.
  const existingId = text(formData, "trialId");
  if (existingId && existingId !== "neu") {
    const existing = await prisma.trialLesson.findUnique({ where: { id: existingId }, select: { courseId: true } });
    if (!existing || existing.courseId !== courseId) {
      return { ok: false, message: "Diese Probestunde gehört nicht zum gewählten Kurs." };
    }
    const added = await addTrialGuests({ trialId: existingId, guests: students, delivery: mode });
    if (!added) return { ok: false, message: "Diese Probestunde ist abgesagt oder schon vorbei." };
    revalidatePath("/teacher/termine");
    return trialResult(added.results, mode, `${formatZonedDateTime(added.trial.startsAt, timeZone, "full")} Uhr`, false);
  }

  let startsAt: Date;
  try {
    startsAt = parseZonedDateTime(text(formData, "trialStartsAt"), timeZone);
  } catch {
    return { ok: false, message: "Bitte Datum und Uhrzeit der Probestunde angeben." };
  }
  if (startsAt.getTime() < Date.now() + 15 * 60_000) {
    return { ok: false, message: "Die Probestunde muss in der Zukunft liegen (mindestens 15 Minuten ab jetzt)." };
  }
  const durationValue = Number(text(formData, "trialDuration"));
  const durationMin = (TRIAL_DURATIONS as readonly number[]).includes(durationValue) ? durationValue : 30;

  try {
    const { results } = await createTrialLesson({
      courseId,
      createdById: userId,
      startsAt,
      durationMin,
      guests: students,
      delivery: mode,
    });
    revalidatePath("/teacher/termine");
    return trialResult(results, mode, `${formatZonedDateTime(startsAt, timeZone, "full")} Uhr`, true);
  } catch (err) {
    console.error("Probestunde konnte nicht angelegt werden:", err);
    const detail = err instanceof Error && err.message.includes("Zoom") ? ` ${err.message}` : "";
    return { ok: false, message: `Die Probestunde konnte nicht angelegt werden.${detail}` };
  }
}

function trialResult(
  results: { name: string; email: string; ok: boolean; mailed: boolean; shareText: string }[],
  mode: InviteDelivery,
  when: string,
  created: boolean,
): StudentInviteState {
  const okCount = results.filter((r) => r.ok).length;
  const anyMailed = results.some((r) => r.mailed);
  const mailNote =
    mode === "mail" && !anyMailed && okCount > 0
      ? " Kein E-Mail-Dienst eingerichtet (lokal): Die Mails stehen in der Server-Konsole."
      : "";
  const start = created ? `Probestunde am ${when} angelegt` : `Zur Probestunde am ${when} eingeladen`;
  return {
    ok: okCount > 0,
    message:
      mode === "mail"
        ? `${start}, ${okCount} von ${results.length} Einladungen verschickt.${mailNote} Du findest sie unter „Termine“.`
        : `${start}. Schicke die Nachrichten selbst weiter, z. B. per WhatsApp. Du findest sie unter „Termine“.`,
    results: results.map((r) => ({
      name: r.name,
      email: r.email,
      ok: r.ok,
      message: r.ok ? "" : "Die Einladung konnte nicht verschickt werden.",
      shareText: r.shareText,
    })),
  };
}
