"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteSampleAudio } from "@/lib/reading-samples";
import { cancelTrialLesson } from "@/lib/trial-lessons";

// Probestunde absagen (Lehrkraft des Kurses oder Admin); die Gaeste bekommen eine Absage.
export async function cancelTrial(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  const id = String(formData.get("trialId") ?? "");
  const trial = await prisma.trialLesson.findUnique({ where: { id }, select: { course: { select: { teacherId: true } } } });
  if (!trial) return;
  if (session.user.role !== "ADMIN" && trial.course.teacherId !== session.user.id) throw new Error("Nicht berechtigt.");
  await cancelTrialLesson(id);
  revalidatePath("/teacher/termine");
}

// Hoerprobe eines Probestunden-Gastes als gehoert markieren bzw. die Markierung entfernen.
export async function toggleTrialSampleListened(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  const id = String(formData.get("sampleId") ?? "");
  const sample = await prisma.trialSample.findUnique({
    where: { id },
    select: { listenedAt: true, trialGuest: { select: { trialLesson: { select: { course: { select: { teacherId: true } } } } } } },
  });
  if (!sample) return;
  if (session.user.role !== "ADMIN" && sample.trialGuest.trialLesson.course.teacherId !== session.user.id) {
    throw new Error("Nicht berechtigt.");
  }
  await prisma.trialSample.update({ where: { id }, data: { listenedAt: sample.listenedAt ? null : new Date() } });
  revalidatePath("/teacher/termine");
}

// Einen Gast aus einer Probestunde entfernen (z. B. doppelt eingeladen). Seine Hoerproben
// werden mitgeloescht; der Gast bekommt keine Nachricht.
export async function removeTrialGuest(formData: FormData) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  const id = String(formData.get("guestId") ?? "");
  const guest = await prisma.trialGuest.findUnique({
    where: { id },
    select: {
      samples: { select: { blobPathname: true } },
      trialLesson: { select: { course: { select: { teacherId: true } } } },
    },
  });
  if (!guest) return;
  if (session.user.role !== "ADMIN" && guest.trialLesson.course.teacherId !== session.user.id) {
    throw new Error("Nicht berechtigt.");
  }
  for (const sample of guest.samples) await deleteSampleAudio(sample);
  await prisma.trialGuest.delete({ where: { id } });
  revalidatePath("/teacher/termine");
}
