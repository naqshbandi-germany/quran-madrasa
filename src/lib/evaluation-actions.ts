"use server";

import { AttendanceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { surahAyahCount } from "@/lib/surahs";

const MAX_TEXT = 2000;

const optionalText = z
  .string()
  .nullish()
  .transform((v) => (v && v.trim() !== "" ? v.trim().slice(0, MAX_TEXT) : null));

const optionalInt = (min: number, max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : null))
    .pipe(z.number().int().min(min).max(max).nullable());

const rowSchema = z.object({
  attendance: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null))
    .pipe(z.nativeEnum(AttendanceStatus).nullable()),
  surah: optionalInt(1, 114),
  ayah: optionalInt(1, 286),
  tajweedRating: optionalInt(1, 5),
  comment: optionalText,
});

// Speichert die Auswertung einer Stunde: Notiz fuer alle (Inhalt, Hausaufgabe) und pro
// eingeschriebenem Teilnehmer Anwesenheit und Lernstand. Leere Zeilen werden entfernt.
export async function saveSessionEvaluation(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }

  const sessionId = z.string().cuid().parse(formData.get("sessionId"));
  const classSession = await prisma.classSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      course: {
        select: { id: true, teacherId: true, enrollments: { select: { participantId: true } } },
      },
    },
  });
  if (session.user.role !== "ADMIN" && session.user.id !== classSession.course.teacherId) {
    throw new Error("Nicht berechtigt.");
  }

  const lessonContent = optionalText.parse(formData.get("lessonContent"));
  const homework = optionalText.parse(formData.get("homework"));
  const readingRequest = optionalText.parse(formData.get("readingRequest"));

  // Nur Teilnehmer, die (noch) im Kurs sind, plus solche, die schon eine Auswertung zu dieser
  // Stunde haben (z. B. inzwischen ausgetreten).
  const existing = await prisma.sessionEvaluation.findMany({
    where: { sessionId },
    select: { participantId: true },
  });
  const participantIds = [
    ...new Set([
      ...classSession.course.enrollments.map((e) => e.participantId),
      ...existing.map((e) => e.participantId),
    ]),
  ];

  const writes = participantIds.map((participantId) => {
    const row = rowSchema.parse({
      attendance: formData.get(`attendance_${participantId}`),
      surah: formData.get(`surah_${participantId}`),
      ayah: formData.get(`ayah_${participantId}`),
      tajweedRating: formData.get(`tajweed_${participantId}`),
      comment: formData.get(`comment_${participantId}`),
    });
    // Vers nur mit Sure und nicht ueber die Verszahl der Sure hinaus.
    if (!row.surah) row.ayah = null;
    else if (row.ayah && row.ayah > (surahAyahCount(row.surah) ?? 0)) row.ayah = surahAyahCount(row.surah);

    const isEmpty =
      !row.attendance && !row.surah && !row.ayah && !row.tajweedRating && !row.comment;
    const where = { sessionId_participantId: { sessionId, participantId } };
    if (isEmpty) return prisma.sessionEvaluation.deleteMany({ where: { sessionId, participantId } });
    return prisma.sessionEvaluation.upsert({
      where,
      create: { sessionId, participantId, ...row },
      update: row,
    });
  });

  await prisma.$transaction([
    prisma.classSession.update({ where: { id: sessionId }, data: { lessonContent, homework, readingRequest } }),
    ...writes,
  ]);

  revalidatePath(`/teacher/courses/${classSession.course.id}`);
  revalidatePath(`/teacher/courses/${classSession.course.id}/sitzungen/${sessionId}`);
  revalidatePath("/dashboard", "layout");
  redirect(`/teacher/courses/${classSession.course.id}/sitzungen/${sessionId}?gespeichert=1`);
}
