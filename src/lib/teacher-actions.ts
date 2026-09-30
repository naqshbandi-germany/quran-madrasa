"use server";

import { AgeGroup, ClassroomType, Weekday } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { generateJitsiUrl } from "@/lib/jitsi";
import { prisma } from "@/lib/prisma";

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
  startsAt: z.coerce.date(),
  joinUrl: z.string().url().optional().or(z.literal("")),
});

export async function createClassSession(formData: FormData) {
  const session = await requireTeacher();

  const parsed = createSessionSchema.parse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    joinUrl: formData.get("joinUrl") ?? "",
  });

  const course = await prisma.course.findUniqueOrThrow({ where: { id: parsed.courseId } });
  assertOwnsCourse(session, course.teacherId);

  // Ohne manuellen Link automatisch einen Jitsi-Meeting-Link generieren.
  const joinUrl = parsed.joinUrl || generateJitsiUrl(course.slug);
  const classroomType = parsed.joinUrl ? ClassroomType.ZOOM : ClassroomType.JITSI;

  await prisma.classSession.create({
    data: {
      courseId: parsed.courseId,
      title: parsed.title,
      startsAt: parsed.startsAt,
      joinUrl,
      classroomType,
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
  firstDate: z.coerce.date(),
  interval: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  occurrences: z.coerce.number().int().min(1).max(52),
});

function addInterval(date: Date, interval: "WEEKLY" | "BIWEEKLY" | "MONTHLY", index: number) {
  const result = new Date(date);
  if (interval === "MONTHLY") {
    result.setMonth(result.getMonth() + index);
  } else {
    const days = interval === "WEEKLY" ? 7 : 14;
    result.setDate(result.getDate() + index * days);
  }
  return result;
}

// Legt mehrere Sitzungen auf einmal an (z.B. "12x woechentlich ab dem 5.10."),
// jede mit automatisch generiertem Jitsi-Link.
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

  const course = await prisma.course.findUniqueOrThrow({ where: { id: parsed.courseId } });
  assertOwnsCourse(session, course.teacherId);

  const [hours, minutes] = parsed.startTime.split(":").map(Number);
  const [durationHours, durationMinutes] = parsed.endTime.split(":").map(Number);
  const durationMin = durationHours * 60 + durationMinutes - (hours * 60 + minutes);

  const sessions = Array.from({ length: parsed.occurrences }, (_, i) => {
    const date = addInterval(parsed.firstDate, parsed.interval, i);
    date.setHours(hours, minutes, 0, 0);
    return {
      courseId: parsed.courseId,
      title: parsed.title,
      startsAt: date,
      durationMin: durationMin > 0 ? durationMin : 60,
      joinUrl: generateJitsiUrl(course.slug),
      classroomType: ClassroomType.JITSI,
    };
  });

  await prisma.classSession.createMany({ data: sessions });

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
