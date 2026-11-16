"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
