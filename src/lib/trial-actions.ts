"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { emailOptionsFromForm } from "@/lib/email-override";
import { prisma } from "@/lib/prisma";
import { deleteSampleAudio } from "@/lib/reading-samples";
import { cancelTrialLesson } from "@/lib/trial-lessons";

export type CancelTrialState = { ok: boolean; message: string } | null;

// Probestunde absagen (Lehrkraft des Kurses oder Admin); die Gaeste bekommen eine Absage (Text
// aus der eigenen Vorlage bzw. in der Vorschau angepasst).
export async function cancelTrial(_prev: CancelTrialState, formData: FormData): Promise<CancelTrialState> {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  const id = String(formData.get("trialId") ?? "");
  const trial = await prisma.trialLesson.findUnique({ where: { id }, select: { course: { select: { teacherId: true } } } });
  if (!trial) return { ok: false, message: "Diese Probestunde gibt es nicht mehr." };
  if (session.user.role !== "ADMIN" && trial.course.teacherId !== session.user.id) throw new Error("Nicht berechtigt.");
  const email = await emailOptionsFromForm(formData, "trial_cancelled", session.user.id);
  if (!email.ok) return { ok: false, message: email.message };
  await cancelTrialLesson(id, email.options);
  revalidatePath("/teacher/termine");
  return { ok: true, message: "Die Probestunde ist abgesagt." };
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
    select: {
      listenedAt: true,
      trialGuest: { select: { trialLesson: { select: { course: { select: { teacherId: true } } } } } },
      invitation: { select: { courseId: true, course: { select: { teacherId: true } } } },
    },
  });
  if (!sample) return;
  const teacherId = sample.trialGuest?.trialLesson.course.teacherId ?? sample.invitation?.course.teacherId;
  if (session.user.role !== "ADMIN" && teacherId !== session.user.id) {
    throw new Error("Nicht berechtigt.");
  }
  await prisma.trialSample.update({ where: { id }, data: { listenedAt: sample.listenedAt ? null : new Date() } });
  revalidatePath("/teacher/termine");
  revalidatePath("/teacher/mediathek");
  if (sample.invitation) revalidatePath(`/teacher/courses/${sample.invitation.courseId}/leseproben`);
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
