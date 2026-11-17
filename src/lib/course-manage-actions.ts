"use server";

import { AgeGroup } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import type { ActionResult } from "@/lib/account-actions";
import { validateParticipant } from "@/lib/participant-rules";
import { prisma } from "@/lib/prisma";
import { deleteZoomMeeting } from "@/lib/zoom";

// Aktionen der Kursverwaltung (Reiter Teilnehmer, Nachrichten, Einstellungen). Lehrkraefte
// duerfen nur ihre eigenen Kurse bearbeiten, Admins alle.

async function requireCourseAccess(courseId: string) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("Kurs nicht gefunden.");
  if (session.user.role !== "ADMIN" && course.teacherId !== session.user.id) throw new Error("Nicht berechtigt.");
  return { session, course, isAdmin: session.user.role === "ADMIN" };
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function revalidateCourse(courseId: string, slug: string) {
  revalidatePath("/teacher");
  revalidatePath("/teacher/kurse");
  revalidatePath(`/teacher/courses/${courseId}`, "layout");
  revalidatePath("/");
  revalidatePath("/quran");
  revalidatePath("/stundenplan");
  revalidatePath(`/courses/${slug}`);
}

// --- Einstellungen -------------------------------------------------------------------------

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

// "JJJJ-MM-TT" aus <input type="date">; leer = nicht gesetzt.
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
  .refine((v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v), "Ungültiges Datum.")
  .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null));

const courseDetailsSchema = z.object({
  title: z.string().trim().min(3, "Der Titel braucht mindestens 3 Zeichen.").max(120, "Der Titel ist zu lang."),
  description: z.string().trim().min(10, "Die Beschreibung braucht mindestens 10 Zeichen."),
  category: z.string().trim().min(2, "Bitte gib eine Kategorie an."),
  level: optionalText,
  ageGroups: z.array(z.nativeEnum(AgeGroup)).default([]),
  maxParticipants: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : null))
    .pipe(z.number({ invalid_type_error: "Bitte eine Zahl angeben." }).int().min(1).max(500).nullable()),
  startsOn: optionalDate,
  endsOn: optionalDate,
});

// Titel, Beschreibung, Kategorie, Level, Altersgruppen, Teilnehmerbegrenzung und Laufzeit.
// Preis, Stripe und Sichtbarkeit speichert der Admin ueber updateCourseSettings.
export async function updateCourseDetails(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { course } = await requireCourseAccess(text(formData, "courseId"));

  const parsed = courseDetailsSchema.safeParse({
    title: text(formData, "title"),
    description: text(formData, "description"),
    category: text(formData, "category"),
    level: text(formData, "level"),
    ageGroups: formData.getAll("ageGroups"),
    maxParticipants: text(formData, "maxParticipants"),
    startsOn: text(formData, "startsOn"),
    endsOn: text(formData, "endsOn"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !errors[key]) errors[key] = issue.message;
    }
    return { ok: false, message: "Bitte prüfe die markierten Felder.", errors };
  }
  const data = parsed.data;
  if (data.startsOn && data.endsOn && data.endsOn < data.startsOn) {
    return { ok: false, message: "Bitte prüfe die markierten Felder.", errors: { endsOn: "Das Ende liegt vor dem Beginn." } };
  }

  await prisma.course.update({ where: { id: course.id }, data });
  revalidateCourse(course.id, course.slug);
  return { ok: true, message: "Gespeichert." };
}

// --- Loeschen ------------------------------------------------------------------------------

// Loescht einen Kurs samt Sitzungen, Stundenplan, Probestunden, Einladungen und Warteliste.
// Nur moeglich, solange niemand eingeschrieben ist (Abos und Zahlungen haengen daran).
export async function deleteCourse(formData: FormData) {
  const courseId = text(formData, "courseId");
  const { course } = await requireCourseAccess(courseId);

  const enrolled = await prisma.enrollment.count({ where: { courseId } });
  if (enrolled > 0) redirect(`/teacher/kurse?loeschen=teilnehmer`);

  const meetings = await prisma.classSession.findMany({
    where: { courseId, zoomMeetingId: { not: null } },
    select: { zoomMeetingId: true },
  });
  const trialMeetings = await prisma.trialLesson.findMany({
    where: { courseId, zoomMeetingId: { not: null } },
    select: { zoomMeetingId: true },
  });
  for (const m of [...meetings, ...trialMeetings]) {
    try {
      await deleteZoomMeeting(m.zoomMeetingId!);
    } catch (err) {
      console.error("Zoom-Meeting konnte nicht gelöscht werden:", err);
    }
  }

  await prisma.$transaction([
    prisma.classSession.deleteMany({ where: { courseId } }),
    prisma.scheduleSlot.deleteMany({ where: { courseId } }),
    prisma.course.delete({ where: { id: courseId } }),
  ]);

  revalidateCourse(course.id, course.slug);
  redirect("/teacher/kurse?geloescht=1");
}

// --- WhatsApp-Gruppe -------------------------------------------------------------------------

// Markiert alle Teilnehmer dieses Kurses mit derselben WhatsApp-Nummer (z. B. Geschwister) als
// "in die Gruppe aufgenommen" bzw. nimmt die Markierung zurueck.
export async function setWhatsappAdded(courseId: string, whatsapp: string, added: boolean) {
  const { course } = await requireCourseAccess(courseId);
  await prisma.enrollment.updateMany({
    where: { courseId, participant: { whatsapp } },
    data: { whatsappAddedAt: added ? new Date() : null },
  });
  revalidatePath(`/teacher/courses/${course.id}`, "layout");
}

// --- Teilnehmer bearbeiten (nur Admins) ----------------------------------------------------

export async function adminUpdateParticipant(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (session?.user.role !== "ADMIN") throw new Error("Nicht berechtigt.");

  const participant = await prisma.participant.findUnique({ where: { id: text(formData, "participantId") } });
  if (!participant) return { ok: false, message: "Teilnehmer nicht gefunden." };
  const isSelf = participant.relation === "SELF";

  const { errors, clean } = validateParticipant({
    relation: participant.relation,
    name: text(formData, "name"),
    muslimName: text(formData, "muslimName"),
    // Bei "selbst" ist die E-Mail die Anmeldeadresse des Kontos und bleibt hier unveraendert.
    email: isSelf ? (participant.email ?? "") : text(formData, "email"),
    birthYear: participant.relation === "CHILD" ? text(formData, "birthYear") : "",
    // WhatsApp-Nummer und Einwilligung gibt nur die Person selbst an.
    whatsapp: participant.whatsapp ?? "",
    whatsappConsent: participant.whatsappConsentAt !== null,
    consentConfirmed: true,
  });
  if (!clean) return { ok: false, message: "Bitte prüfe die markierten Felder.", errors: errors as Record<string, string> };

  await prisma.participant.update({
    where: { id: participant.id },
    data: { name: clean.name, muslimName: clean.muslimName, email: clean.email, birthYear: clean.birthYear },
  });
  // Name und muslimischer Name von "selbst" gehoeren zum Konto (Anrede in Mails, Kopfzeile).
  if (isSelf) {
    await prisma.user.update({
      where: { id: participant.ownerId },
      data: { name: clean.name, muslimName: clean.muslimName },
    });
  }

  revalidatePath("/teacher", "layout");
  return { ok: true, message: "Gespeichert." };
}
