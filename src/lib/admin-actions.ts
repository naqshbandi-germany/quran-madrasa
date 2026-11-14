"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { generateAccessCode } from "@/lib/course-access";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== Role.ADMIN) {
    throw new Error("Nicht berechtigt.");
  }
  return session;
}

// Lehrer, Admins und Schueler einladen: siehe lib/invite-actions.ts.

const updateTeacherProfileSchema = z.object({
  teacherId: z.string().cuid(),
  email: z.string().trim().toLowerCase().email(),
  bio: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null)),
  image: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim() : null))
    .refine((v) => !v || z.string().url().safeParse(v).success, "Muss eine gültige URL sein."),
  zoomEmail: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? v.trim().toLowerCase() : null))
    .refine((v) => !v || z.string().email().safeParse(v).success, "Muss eine gültige E-Mail sein."),
});

export async function updateTeacherProfile(formData: FormData) {
  await requireAdmin();

  const parsed = updateTeacherProfileSchema.parse({
    teacherId: formData.get("teacherId"),
    email: formData.get("email"),
    bio: formData.get("bio"),
    image: formData.get("image"),
    zoomEmail: formData.get("zoomEmail"),
  });

  const taken = await prisma.user.findFirst({
    where: { email: parsed.email, id: { not: parsed.teacherId } },
    select: { id: true },
  });
  if (taken) redirect("/admin?einladung=vergeben#lehrer");

  // Neue Adresse: Links, die an die alte Adresse gingen, entwerten.
  const before = await prisma.user.findUnique({ where: { id: parsed.teacherId }, select: { email: true } });
  if (before && before.email !== parsed.email) {
    await prisma.passwordResetToken.deleteMany({ where: { userId: parsed.teacherId } });
  }

  await prisma.user.update({
    where: { id: parsed.teacherId, role: Role.TEACHER },
    data: { email: parsed.email, bio: parsed.bio, image: parsed.image, zoomEmail: parsed.zoomEmail },
  });

  revalidatePath("/admin");
  revalidatePath("/lehrer");
}

const updateSiteContentSchema = z.object({
  missionStatement: z.string().max(5000),
});

export async function updateSiteContent(formData: FormData) {
  await requireAdmin();

  const parsed = updateSiteContentSchema.parse({
    missionStatement: formData.get("missionStatement") ?? "",
  });

  await prisma.siteContent.upsert({
    where: { id: "main" },
    create: { id: "main", missionStatement: parsed.missionStatement },
    update: { missionStatement: parsed.missionStatement },
  });

  revalidatePath("/admin");
  revalidatePath("/ueber-uns");
}

const updateLegalTextsSchema = z.object({
  impressum: z.string().max(20000),
  privacyPolicy: z.string().max(40000),
});

export async function updateLegalTexts(formData: FormData) {
  await requireAdmin();

  const parsed = updateLegalTextsSchema.parse({
    impressum: formData.get("impressum") ?? "",
    privacyPolicy: formData.get("privacyPolicy") ?? "",
  });

  await prisma.siteContent.upsert({
    where: { id: "main" },
    create: { id: "main", ...parsed },
    update: parsed,
  });

  revalidatePath("/admin");
  revalidatePath("/impressum");
  revalidatePath("/datenschutz");
}

// Betrag in Euro aus einem Formularfeld ("5", "5,00", "29.90") in Cent; leer = null.
const euroField = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim().replace(",", ".") : null))
  .refine((v) => v === null || /^\d+(\.\d{1,2})?$/.test(v), "Ungültiger Betrag.")
  .transform((v) => (v === null ? null : Math.round(Number(v) * 100)));

const optionalText = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v.trim() : null));

const stripePriceField = optionalText.refine(
  (v) => v === null || /^price_[A-Za-z0-9]+$/.test(v),
  "Stripe-Preis-IDs beginnen mit price_.",
);

const updateCourseSettingsSchema = z.object({
  courseId: z.string().cuid(),
  price: euroField,
  stripePriceId: stripePriceField,
  signupFee: euroField,
  signupFeePriceId: stripePriceField,
  maxParticipants: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v) : null))
    .pipe(z.number().int().min(1).max(500).nullable()),
  isHidden: z.boolean(),
});

// Preis, Stripe-Preise, Teilnehmerbegrenzung und Sichtbarkeit eines Kurses. Ein versteckter Kurs
// bekommt beim ersten Speichern automatisch einen geheimen Zugangscode.
export async function updateCourseSettings(formData: FormData) {
  await requireAdmin();

  const parsed = updateCourseSettingsSchema.parse({
    courseId: formData.get("courseId"),
    price: formData.get("price") ?? undefined,
    stripePriceId: formData.get("stripePriceId") ?? undefined,
    signupFee: formData.get("signupFee") ?? undefined,
    signupFeePriceId: formData.get("signupFeePriceId") ?? undefined,
    maxParticipants: formData.get("maxParticipants") ?? undefined,
    isHidden: formData.get("isHidden") === "on",
  });

  if (parsed.signupFee && !parsed.signupFeePriceId) {
    throw new Error("Für die Anmeldegebühr wird eine Stripe-Preis-ID (einmalig) benötigt.");
  }

  const course = await prisma.course.findUniqueOrThrow({ where: { id: parsed.courseId } });
  await prisma.course.update({
    where: { id: course.id },
    data: {
      priceCents: parsed.price ?? 0,
      stripePriceId: parsed.stripePriceId,
      signupFeeCents: parsed.signupFee,
      signupFeePriceId: parsed.signupFee ? parsed.signupFeePriceId : null,
      maxParticipants: parsed.maxParticipants,
      isHidden: parsed.isHidden,
      accessCode: parsed.isHidden ? (course.accessCode ?? generateAccessCode()) : course.accessCode,
    },
  });

  revalidateCoursePages(course.slug);
}

// Neuer geheimer Link fuer einen versteckten Kurs; der alte Link funktioniert danach nicht mehr.
export async function regenerateAccessCode(formData: FormData) {
  await requireAdmin();
  const courseId = z.string().cuid().parse(formData.get("courseId"));
  const course = await prisma.course.update({
    where: { id: courseId },
    data: { accessCode: generateAccessCode() },
  });
  revalidateCoursePages(course.slug);
}

function revalidateCoursePages(slug: string) {
  revalidatePath("/admin");
  revalidatePath("/teacher");
  revalidatePath("/");
  revalidatePath("/quran");
  revalidatePath("/stundenplan");
  revalidatePath("/lehrer");
  revalidatePath(`/courses/${slug}`);
}
