"use server";

import { AgeGroup, ClassroomType, Weekday } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { createClassroomMeeting, createClassroomMeetings } from "@/lib/classroom";
import { groupRecipients } from "@/lib/enrollment-recipients";
import { materialEmailHtml } from "@/lib/material-email";
import { prisma } from "@/lib/prisma";
import { MATERIAL_EMAIL_FROM, getResend } from "@/lib/resend";
import { fromTeachingLocal, parseTeachingDateTime } from "@/lib/schedule-time";

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

const sendCourseMaterialSchema = z.object({
  courseId: z.string().cuid(),
  subject: z.string().min(3).max(200),
  message: z.string().min(10).max(5000),
});

// Schickt eine freie Nachricht (z.B. Kursmaterial, Hausaufgaben, Ankuendigungen) per
// E-Mail an alle aktuell eingeschriebenen Teilnehmer des Kurses, getrennt von den
// automatischen Sitzungs-Erinnerungen (siehe MATERIAL_EMAIL_FROM).
export async function sendCourseMaterial(formData: FormData) {
  const session = await requireTeacher();

  const parsed = sendCourseMaterialSchema.parse({
    courseId: formData.get("courseId"),
    subject: formData.get("subject"),
    message: formData.get("message"),
  });

  const course = await prisma.course.findUniqueOrThrow({
    where: { id: parsed.courseId },
    include: {
      enrollments: {
        include: {
          user: { select: { name: true, email: true } },
          participant: { select: { name: true, email: true } },
        },
      },
    },
  });
  assertOwnsCourse(session, course.teacherId);

  const resend = getResend();

  for (const recipient of groupRecipients(course.enrollments)) {
    try {
      await resend.emails.send({
        from: MATERIAL_EMAIL_FROM,
        to: recipient.email,
        subject: parsed.subject,
        html: materialEmailHtml({
          studentName: recipient.greetingName,
          courseTitle: course.title,
          message: parsed.message,
        }),
      });
    } catch (err) {
      console.error(`Kursmaterial-E-Mail an ${recipient.email} fehlgeschlagen:`, err);
    }
  }

  revalidatePath(`/teacher/courses/${parsed.courseId}`);
}
