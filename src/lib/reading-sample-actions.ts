"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAccessSample, canReviewSample, deleteSampleAudio } from "@/lib/reading-samples";

async function loadSample(id: string) {
  return prisma.readingSample.findUniqueOrThrow({
    where: { id },
    include: {
      participant: { select: { ownerId: true } },
      course: { select: { id: true, teacherId: true } },
    },
  });
}

function revalidateSamplePages(courseId: string) {
  revalidatePath(`/teacher/courses/${courseId}`, "layout");
  revalidatePath("/dashboard", "layout");
}

// Lehrkraft: Leseprobe als gehoert markieren und eine kurze Rueckmeldung speichern.
export async function reviewReadingSample(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Nicht angemeldet.");
  const { sampleId, comment, listened } = z
    .object({
      sampleId: z.string().cuid(),
      comment: z
        .string()
        .nullish()
        .transform((v) => (v && v.trim() !== "" ? v.trim().slice(0, 2000) : null)),
      listened: z.string().nullish(),
    })
    .parse({
      sampleId: formData.get("sampleId"),
      comment: formData.get("comment"),
      listened: formData.get("listened"),
    });

  const sample = await loadSample(sampleId);
  if (!canReviewSample(session.user, sample)) throw new Error("Nicht berechtigt.");

  const isListened = Boolean(listened) || Boolean(comment);
  await prisma.readingSample.update({
    where: { id: sampleId },
    data: {
      teacherComment: comment,
      listenedAt: isListened ? (sample.listenedAt ?? new Date()) : null,
    },
  });
  revalidateSamplePages(sample.course.id);
}

// Konto-Inhaber, Lehrkraft oder Admin: Leseprobe endgueltig loeschen.
export async function deleteReadingSample(formData: FormData) {
  const session = await auth();
  if (!session) throw new Error("Nicht angemeldet.");
  const sampleId = z.string().cuid().parse(formData.get("sampleId"));

  const sample = await loadSample(sampleId);
  if (!canAccessSample(session.user, sample)) throw new Error("Nicht berechtigt.");

  await deleteSampleAudio(sample);
  await prisma.readingSample.delete({ where: { id: sampleId } });
  revalidateSamplePages(sample.course.id);
}
