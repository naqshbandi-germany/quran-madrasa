"use server";

import { ClassroomType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireTeacher() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  return session;
}

const createCourseSchema = z.object({
  title: z.string().min(3),
  slug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/, "Nur Kleinbuchstaben, Ziffern und Bindestriche."),
  description: z.string().min(10),
  category: z.string().min(2),
  priceCents: z.coerce.number().int().positive(),
});

export async function createCourse(formData: FormData) {
  const session = await requireTeacher();

  const parsed = createCourseSchema.parse({
    title: formData.get("title"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    category: formData.get("category"),
    priceCents: formData.get("priceCents"),
  });

  await prisma.course.create({
    data: { ...parsed, teacherId: session.user.id, isPublished: false },
  });

  revalidatePath("/teacher");
}

const createSessionSchema = z.object({
  courseId: z.string().cuid(),
  title: z.string().min(3),
  startsAt: z.coerce.date(),
  joinUrl: z.string().url().optional().or(z.literal("")),
});

export async function createClassSession(formData: FormData) {
  await requireTeacher();

  const parsed = createSessionSchema.parse({
    courseId: formData.get("courseId"),
    title: formData.get("title"),
    startsAt: formData.get("startsAt"),
    joinUrl: formData.get("joinUrl") ?? "",
  });

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
  await requireTeacher();
  const { courseId } = togglePublishSchema.parse({ courseId: formData.get("courseId") });

  const course = await prisma.course.findUniqueOrThrow({ where: { id: courseId } });
  await prisma.course.update({
    where: { id: courseId },
    data: { isPublished: !course.isPublished },
  });

  revalidatePath("/teacher");
}
