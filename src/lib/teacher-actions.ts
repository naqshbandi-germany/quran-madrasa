"use server";

import { AgeGroup, ClassroomType, Weekday } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
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

  await prisma.classSession.create({
    data: {
      courseId: parsed.courseId,
      title: parsed.title,
      startsAt: parsed.startsAt,
      joinUrl: parsed.joinUrl || null,
      classroomType: ClassroomType.ZOOM,
    },
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
