"use server";

import { AgeGroup, ClassroomType, type Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { createClassroomMeeting } from "@/lib/classroom";
import { sendSessionChangeNotice } from "@/lib/notification-email";
import { prisma } from "@/lib/prisma";
import { parseZonedDateTime } from "@/lib/schedule-time";
import { zoomUpdateWarning } from "@/lib/series";
import { resolveViewTimeZone } from "@/lib/view-time-zone";
import { deleteZoomMeeting, updateZoomMeeting } from "@/lib/zoom";

async function requireTeacher() {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  return session;
}

// Lehrer duerfen nur ihre eigenen Kurse bearbeiten; Admins duerfen alle.
function assertOwnsCourse(session: { user: { id: string; role: string } }, teacherId: string) {
  if (session.user.role !== "ADMIN" && session.user.id !== teacherId) {
    throw new Error("Nicht berechtigt.");
  }
}

const createCourseSchema = z.object({
  title: z.string().min(3),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche."),
  description: z.string().min(10),
  category: z.string().min(2),
  level: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  ageGroups: z.array(z.nativeEnum(AgeGroup)).default([]),
  priceCents: z.coerce.number().int().positive(),
  // leer = unbegrenzt
  maxParticipants: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : null))
    .pipe(z.number().int().min(1).max(500).nullable()),
});

export async function createCourse(formData: FormData) {
  const session = await requireTeacher();

  const parsed = createCourseSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    category: formData.get("category"),
    level: formData.get("level"),
    ageGroups: formData.getAll("ageGroups"),
    priceCents: formData.get("priceCents"),
    maxParticipants: formData.get("maxParticipants") ?? undefined,
  });

  await prisma.course.create({
    data: { ...parsed, teacherId: session.user.id, isPublished: false },
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/kurse");
}


const togglePublishSchema = z.object({
  courseId: z.string().cuid(),
});

export async function togglePublish(formData: FormData) {
  const session = await requireTeacher();
  const { courseId } = togglePublishSchema.parse({ courseId: formData.get("courseId") });

  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  assertOwnsCourse(session, course.teacherId);

  await prisma.course.update({
    where: { id: courseId },
    data: { isPublished: !course.isPublished },
  });

  revalidatePath("/teacher");
  revalidatePath("/teacher/kurse");
  revalidatePath("/");
  revalidatePath(`/courses/${course.slug}`);
}


// --- Einzelne Stunden ------------------------------------------------------------------------
// Nach jeder Aktion zurueck in den Reiter Sitzungen, mit Hinweis oder Fehlermeldung oben auf der
// Seite. Ein Zoom-Fehler fuehrt so nicht mehr zu einer Fehlerseite.

function backToSessions(courseId: string, message: string, kind: "hinweis" | "fehler" = "hinweis"): never {
  redirect(`/teacher/courses/${courseId}/sitzungen?${kind}=${encodeURIComponent(message)}`);
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function revalidateSessions(courseId: string) {
  revalidatePath(`/teacher/courses/${courseId}`, "layout");
  revalidatePath("/teacher/termine");
  revalidatePath("/dashboard");
}

const createSessionSchema = z.object({
  courseId: z.string().cuid(),
  title: z.string().trim().min(3, "Der Titel braucht mindestens 3 Zeichen."),
  // Wert eines datetime-local-Feldes, in der angezeigten Zeitzone.
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Bitte Datum und Uhrzeit angeben."),
  durationMin: z.coerce.number().int().min(5).max(480).default(60),
  joinUrl: z.string().url("Der Link ist ungültig.").optional().or(z.literal("")),
});

export type SessionField = "courseId" | "title" | "startsAt" | "durationMin" | "joinUrl" | "form";
export type SessionFormState = { errors?: Partial<Record<SessionField, string>> };

// Einzelne Stunde ausserhalb einer Serie (z. B. Zusatztermin), mit eigenem oder automatisch
// erzeugtem Meeting-Link. Formular mit useActionState: Fehler kommen je Feld zurueck, die
// Eingaben bleiben erhalten; nach dem Anlegen geht es in den Reiter Sitzungen.
export async function createClassSession(_prev: SessionFormState, formData: FormData): Promise<SessionFormState> {
  const session = await requireTeacher();
  const courseId = String(formData.get("courseId") ?? "");
  if (!courseId) return { errors: { courseId: "Bitte einen Kurs wählen." } };

  const parsed = createSessionSchema.safeParse({
    courseId,
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    durationMin: formData.get("durationMin") || undefined,
    joinUrl: formData.get("joinUrl") ?? "",
  });
  if (!parsed.success) {
    const errors: SessionFormState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as SessionField;
      errors[field] ??= field === "durationMin" ? "Bitte eine Dauer zwischen 5 und 480 Minuten angeben." : issue.message;
    }
    return { errors };
  }
  const data = parsed.data;

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: data.courseId },
    include: { teacher: { select: { zoomEmail: true } } },
  });
  assertOwnsCourse(session, course.teacherId);

  const { timeZone } = await resolveViewTimeZone(session.user.id);
  const startsAt = parseZonedDateTime(data.startsAt, timeZone);

  let meeting: Awaited<ReturnType<typeof createClassroomMeeting>>;
  try {
    meeting = data.joinUrl
      ? { joinUrl: data.joinUrl, classroomType: ClassroomType.ZOOM, zoomMeetingId: null }
      : await createClassroomMeeting({
          courseSlug: course.slug,
          title: data.title,
          startsAt,
          durationMin: data.durationMin,
          teacherZoomEmail: course.teacher.zoomEmail,
        });
  } catch (err) {
    return { errors: { form: `Das Meeting konnte nicht angelegt werden: ${errorText(err)}` } };
  }

  await prisma.classSession.create({
    data: {
      courseId: data.courseId,
      title: data.title,
      startsAt,
      durationMin: data.durationMin,
      joinUrl: meeting.joinUrl,
      classroomType: meeting.classroomType,
      zoomMeetingId: meeting.zoomMeetingId,
    },
  });

  revalidateSessions(course.id);
  backToSessions(course.id, "Stunde angelegt.");
}

const updateSessionSchema = z.object({
  sessionId: z.string().cuid(),
  title: z.string().trim().min(3, "Der Titel braucht mindestens 3 Zeichen."),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Bitte Datum und Uhrzeit angeben."),
  durationMin: z.coerce.number().int().min(5).max(480),
  joinUrl: z.string().url("Der Link ist ungültig.").optional().or(z.literal("")),
});

// Aendert eine einzelne Stunde (Titel, Beginn, Dauer, Link). Ein automatisch erzeugtes
// Zoom-Meeting wird mit angepasst; klappt das nicht, bleibt die Aenderung trotzdem gespeichert
// (der Link bleibt gueltig). Gehoert die Stunde zu einer Serie, gilt sie danach als Ausnahme.
export async function updateClassSession(formData: FormData) {
  const session = await requireTeacher();

  const existing = await prisma.classSession.findUniqueOrThrow({
    where: { id: String(formData.get("sessionId") ?? "") },
    include: { course: true },
  });
  assertOwnsCourse(session, existing.course.teacherId);

  const parsed = updateSessionSchema.safeParse({
    sessionId: existing.id,
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    durationMin: formData.get("durationMin"),
    joinUrl: formData.get("joinUrl") ?? "",
  });
  if (!parsed.success) {
    backToSessions(existing.courseId, parsed.error.issues[0]?.message ?? "Bitte prüfe die Eingaben.", "fehler");
  }
  const data = parsed.data;

  const { timeZone } = await resolveViewTimeZone(session.user.id);
  const startsAt = parseZonedDateTime(data.startsAt, timeZone);
  const moved = startsAt.getTime() !== existing.startsAt.getTime();
  const update: Prisma.ClassSessionUpdateInput = {
    title: data.title,
    startsAt,
    durationMin: data.durationMin,
    ...(existing.seriesId ? { isException: true } : {}),
    ...(moved ? { reminder24hSentAt: null, reminder1hSentAt: null, reminderStartSentAt: null } : {}),
  };

  let warning = "";
  if (data.joinUrl && data.joinUrl !== existing.joinUrl) {
    // Eigener Link ersetzt den automatisch erzeugten (ein altes Zoom-Meeting wird entfernt).
    if (existing.zoomMeetingId) await deleteZoomMeeting(existing.zoomMeetingId);
    update.joinUrl = data.joinUrl;
    update.classroomType = ClassroomType.ZOOM;
    update.zoomMeetingId = null;
  } else if (existing.zoomMeetingId) {
    try {
      await updateZoomMeeting(existing.zoomMeetingId, { topic: data.title, startsAt, durationMin: data.durationMin });
    } catch (err) {
      console.error(`Zoom-Meeting ${existing.zoomMeetingId} konnte nicht angepasst werden:`, err);
      warning = ` ${zoomUpdateWarning(err)}`;
    }
  }

  await prisma.classSession.update({ where: { id: existing.id }, data: update });

  // Kommende Stunde verschoben (Beginn oder Dauer geaendert): Teilnehmer informieren.
  const changedTime = moved || data.durationMin !== existing.durationMin;
  if (changedTime && Math.max(startsAt.getTime(), existing.startsAt.getTime()) > Date.now()) {
    await sendSessionChangeNotice("moved", existing, { startsAt, durationMin: data.durationMin });
  }

  revalidateSessions(existing.courseId);
  backToSessions(existing.courseId, `Stunde gespeichert.${changedTime ? " Die Teilnehmer wurden informiert." : ""}${warning}`);
}

const sessionIdSchema = z.object({ sessionId: z.string().cuid() });

// Kommende Stunde absagen: bleibt durchgestrichen in der Liste, ohne Link und Erinnerungen.
// Die Teilnehmer bekommen eine Mail.
export async function cancelClassSession(formData: FormData) {
  const session = await requireTeacher();
  const { sessionId } = sessionIdSchema.parse({ sessionId: formData.get("sessionId") });
  const existing = await prisma.classSession.findUniqueOrThrow({ where: { id: sessionId }, include: { course: true } });
  assertOwnsCourse(session, existing.course.teacherId);

  if (existing.zoomMeetingId) await deleteZoomMeeting(existing.zoomMeetingId);
  await prisma.classSession.update({
    where: { id: existing.id },
    data: { cancelledAt: new Date(), isException: true, joinUrl: null, zoomMeetingId: null },
  });
  await sendSessionChangeNotice("cancelled", existing);

  revalidateSessions(existing.courseId);
  backToSessions(existing.courseId, "Stunde abgesagt, die Teilnehmer wurden informiert.");
}

// Stunde ganz entfernen (z. B. versehentlich angelegt oder eine abgesagte Stunde). Eine
// kommende, noch nicht abgesagte Stunde gilt dabei als abgesagt (Mail an die Teilnehmer).
export async function deleteClassSession(formData: FormData) {
  const session = await requireTeacher();
  const { sessionId } = sessionIdSchema.parse({ sessionId: formData.get("sessionId") });
  const existing = await prisma.classSession.findUniqueOrThrow({ where: { id: sessionId }, include: { course: true } });
  assertOwnsCourse(session, existing.course.teacherId);
  // Kommende Stunde einer Serie: absagen statt loeschen, sonst legt die Serie sie neu an.
  if (existing.seriesId && existing.startsAt.getTime() > Date.now()) return cancelClassSession(formData);

  if (existing.zoomMeetingId) await deleteZoomMeeting(existing.zoomMeetingId);
  await prisma.classSession.delete({ where: { id: existing.id } });
  if (existing.startsAt.getTime() > Date.now() && !existing.cancelledAt) {
    await sendSessionChangeNotice("cancelled", existing);
  }

  revalidateSessions(existing.courseId);
  backToSessions(existing.courseId, "Stunde entfernt.");
}
