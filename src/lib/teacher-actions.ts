"use server";

import { AgeGroup, ClassroomType, Weekday } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { createClassroomMeeting, createClassroomMeetings } from "@/lib/classroom";
import { prisma } from "@/lib/prisma";
import { fromTeachingLocal, parseTeachingDateTime } from "@/lib/schedule-time";
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
  });

  await prisma.course.create({
    data: { ...parsed, teacherId: session.user.id, isPublished: false },
  });

  revalidatePath("/teacher");
}

const createScheduleSlotSchema = z.object({
  courseId: z.string().cuid(),
  weekday: z.nativeEnum(Weekday),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  note: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
});

export async function createScheduleSlot(formData: FormData) {
  const session = await requireTeacher();

  const parsed = createScheduleSlotSchema.parse({
    courseId: formData.get("courseId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    note: formData.get("note"),
  });

  if (parsed.endTime <= parsed.startTime) throw new Error("Das Ende muss nach dem Beginn liegen.");

  const course = await prisma.course.findUniqueOrThrow({ where: { id: parsed.courseId } });
  assertOwnsCourse(session, course.teacherId);

  await prisma.scheduleSlot.create({ data: parsed });

  revalidatePath(`/teacher/courses/${parsed.courseId}`);
  revalidatePath("/");
}

const deleteScheduleSlotSchema = z.object({
  slotId: z.string().cuid(),
  courseId: z.string().cuid(),
});

export async function deleteScheduleSlot(formData: FormData) {
  const session = await requireTeacher();

  const parsed = deleteScheduleSlotSchema.parse({
    slotId: formData.get("slotId"),
    courseId: formData.get("courseId"),
  });

  const course = await prisma.course.findUniqueOrThrow({ where: { id: parsed.courseId } });
  assertOwnsCourse(session, course.teacherId);

  await prisma.scheduleSlot.delete({ where: { id: parsed.slotId } });

  revalidatePath(`/teacher/courses/${parsed.courseId}`);
  revalidatePath("/");
}

const createSessionSchema = z.object({
  courseId: z.string().cuid(),
  title: z.string().min(3),
  // Wert eines datetime-local-Feldes, in Nordzypern-Ortszeit.
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Ungültiges Datum"),
  durationMin: z.coerce.number().int().min(5).max(480).default(60),
  joinUrl: z.string().url().optional().or(z.literal("")),
});

export async function createClassSession(formData: FormData) {
  const session = await requireTeacher();

  const parsed = createSessionSchema.parse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    durationMin: formData.get("durationMin") || undefined,
    joinUrl: formData.get("joinUrl") ?? "",
  });

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: parsed.courseId },
    include: { teacher: { select: { zoomEmail: true } } },
  });
  assertOwnsCourse(session, course.teacherId);

  const startsAt = parseTeachingDateTime(parsed.startsAt);

  // Eigener Link: wird unveraendert uebernommen. Sonst wird je nach CLASSROOM_PROVIDER
  // automatisch ein Jitsi-Link erzeugt oder ein Zoom-Meeting angelegt.
  const meeting = parsed.joinUrl
    ? { joinUrl: parsed.joinUrl, classroomType: ClassroomType.ZOOM, zoomMeetingId: null }
    : await createClassroomMeeting({
        courseSlug: course.slug,
        title: parsed.title,
        startsAt,
        durationMin: parsed.durationMin,
        teacherZoomEmail: course.teacher.zoomEmail,
      });

  await prisma.classSession.create({
    data: {
      courseId: parsed.courseId,
      title: parsed.title,
      startsAt,
      durationMin: parsed.durationMin,
      joinUrl: meeting.joinUrl,
      classroomType: meeting.classroomType,
      zoomMeetingId: meeting.zoomMeetingId,
    },
  });

  revalidatePath(`/teacher/courses/${parsed.courseId}`);
}

const createRecurringSessionsSchema = z.object({
  courseId: z.string().cuid(),
  title: z.string().min(3),
  weekday: z.nativeEnum(Weekday),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  firstDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum"),
  interval: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  occurrences: z.coerce.number().int().min(1).max(52),
});

// Datum des index-ten Termins (reine Kalenderrechnung ohne Zeitzone).
function addInterval(
  first: { year: number; month: number; day: number },
  interval: "WEEKLY" | "BIWEEKLY" | "MONTHLY",
  index: number,
) {
  if (interval === "MONTHLY") {
    const result = new Date(Date.UTC(first.year, first.month - 1 + index, first.day));
    return { year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate() };
  }
  const days = interval === "WEEKLY" ? 7 : 14;
  const result = new Date(Date.UTC(first.year, first.month - 1, first.day + index * days));
  return { year: result.getUTCFullYear(), month: result.getUTCMonth() + 1, day: result.getUTCDate() };
}

// Legt mehrere Sitzungen auf einmal an (z.B. "12x woechentlich ab dem 5.10."), jede mit
// eigenem Meeting-Link (Jitsi oder Zoom, je nach CLASSROOM_PROVIDER). Datum und Uhrzeit
// sind in Nordzypern-Ortszeit angegeben.
export async function createRecurringSessions(formData: FormData) {
  const session = await requireTeacher();

  const parsed = createRecurringSessionsSchema.parse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    firstDate: formData.get("firstDate"),
    interval: formData.get("interval"),
    occurrences: formData.get("occurrences"),
  });

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: parsed.courseId },
    include: { teacher: { select: { zoomEmail: true } } },
  });
  assertOwnsCourse(session, course.teacherId);

  const [hours, minutes] = parsed.startTime.split(":").map(Number);
  const [endHours, endMinutes] = parsed.endTime.split(":").map(Number);
  const durationMin = endHours * 60 + endMinutes - (hours * 60 + minutes);
  const safeDuration = durationMin > 0 ? durationMin : 60;

  const [year, month, day] = parsed.firstDate.split("-").map(Number);
  const startTimes = Array.from({ length: parsed.occurrences }, (_, i) => {
    const date = addInterval({ year, month, day }, parsed.interval, i);
    return fromTeachingLocal(date.year, date.month, date.day, hours, minutes);
  });

  const meetings = await createClassroomMeetings(
    startTimes.map((startsAt) => ({
      courseSlug: course.slug,
      title: parsed.title,
      startsAt,
      durationMin: safeDuration,
      teacherZoomEmail: course.teacher.zoomEmail,
    })),
  );

  await prisma.classSession.createMany({
    data: startTimes.map((startsAt, i) => ({
      courseId: parsed.courseId,
      title: parsed.title,
      startsAt,
      durationMin: safeDuration,
      joinUrl: meetings[i].joinUrl,
      classroomType: meetings[i].classroomType,
      zoomMeetingId: meetings[i].zoomMeetingId,
    })),
  });

  revalidatePath(`/teacher/courses/${parsed.courseId}`);
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
  revalidatePath("/");
  revalidatePath(`/courses/${course.slug}`);
}

const updateScheduleSlotSchema = createScheduleSlotSchema.extend({ slotId: z.string().cuid() });

export async function updateScheduleSlot(formData: FormData) {
  const session = await requireTeacher();

  const parsed = updateScheduleSlotSchema.parse({
    slotId: formData.get("slotId"),
    courseId: formData.get("courseId"),
    weekday: formData.get("weekday"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    note: formData.get("note"),
  });

  if (parsed.endTime <= parsed.startTime) throw new Error("Das Ende muss nach dem Beginn liegen.");

  const slot = await prisma.scheduleSlot.findUniqueOrThrow({
    where: { id: parsed.slotId },
    include: { course: true },
  });
  assertOwnsCourse(session, slot.course.teacherId);

  await prisma.scheduleSlot.update({
    where: { id: slot.id },
    data: {
      weekday: parsed.weekday,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      note: parsed.note,
    },
  });

  revalidatePath(`/teacher/courses/${slot.courseId}`);
  revalidatePath("/");
  revalidatePath("/stundenplan");
}

const updateSessionSchema = z.object({
  sessionId: z.string().cuid(),
  title: z.string().min(3),
  startsAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Ungültiges Datum"),
  durationMin: z.coerce.number().int().min(5).max(480),
  joinUrl: z.string().url().optional().or(z.literal("")),
});

// Aendert eine bestehende Sitzung (Titel, Beginn in Ortszeit, Dauer, Link). Bei einem
// automatisch erzeugten Zoom-Meeting wird das Meeting mit angepasst. Wurde der Beginn
// verschoben, werden die Erinnerungen neu ausgeloest.
export async function updateClassSession(formData: FormData) {
  const session = await requireTeacher();

  const parsed = updateSessionSchema.parse({
    sessionId: formData.get("sessionId"),
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    durationMin: formData.get("durationMin"),
    joinUrl: formData.get("joinUrl") ?? "",
  });

  const existing = await prisma.classSession.findUniqueOrThrow({
    where: { id: parsed.sessionId },
    include: { course: true },
  });
  assertOwnsCourse(session, existing.course.teacherId);

  const startsAt = parseTeachingDateTime(parsed.startsAt);
  const data: {
    title: string;
    startsAt: Date;
    durationMin: number;
    joinUrl?: string;
    classroomType?: ClassroomType;
    zoomMeetingId?: string | null;
    reminder24hSentAt?: null;
    reminder1hSentAt?: null;
    reminderStartSentAt?: null;
  } = { title: parsed.title, startsAt, durationMin: parsed.durationMin };

  if (startsAt.getTime() !== existing.startsAt.getTime()) {
    data.reminder24hSentAt = null;
    data.reminder1hSentAt = null;
    data.reminderStartSentAt = null;
  }

  if (parsed.joinUrl && parsed.joinUrl !== existing.joinUrl) {
    // Eigener Link ersetzt den automatisch erzeugten (ein altes Zoom-Meeting wird entfernt).
    if (existing.zoomMeetingId) await deleteZoomMeeting(existing.zoomMeetingId);
    data.joinUrl = parsed.joinUrl;
    data.classroomType = ClassroomType.ZOOM;
    data.zoomMeetingId = null;
  } else if (existing.zoomMeetingId) {
    await updateZoomMeeting(existing.zoomMeetingId, {
      topic: parsed.title,
      startsAt,
      durationMin: parsed.durationMin,
    });
  }

  await prisma.classSession.update({ where: { id: existing.id }, data });

  revalidatePath(`/teacher/courses/${existing.courseId}`);
  revalidatePath("/dashboard");
}

const deleteSessionSchema = z.object({ sessionId: z.string().cuid() });

export async function deleteClassSession(formData: FormData) {
  const session = await requireTeacher();
  const { sessionId } = deleteSessionSchema.parse({ sessionId: formData.get("sessionId") });

  const existing = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { course: true },
  });
  assertOwnsCourse(session, existing.course.teacherId);

  if (existing.zoomMeetingId) await deleteZoomMeeting(existing.zoomMeetingId);
  await prisma.classSession.delete({ where: { id: existing.id } });

  revalidatePath(`/teacher/courses/${existing.courseId}`);
  revalidatePath("/dashboard");
}
