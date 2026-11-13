"use server";

import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { generateAccessCode } from "@/lib/course-access";
import { prisma } from "@/lib/prisma";
import { sendTeacherInvite } from "@/lib/teacher-invite";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== Role.ADMIN) {
    throw new Error("Nicht berechtigt.");
  }
  return session;
}

const createTeacherSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
});

// Ergebnis einer Einladung, wird als ?einladung=... auf der Admin-Seite angezeigt.
async function inviteAndReport(userId: string): Promise<never> {
  let outcome: "gesendet" | "lokal" | "fehler";
  try {
    outcome = (await sendTeacherInvite(userId)) ? "gesendet" : "lokal";
  } catch (err) {
    console.error("Lehrer-Einladung konnte nicht gesendet werden:", err);
    outcome = "fehler";
  }
  revalidatePath("/admin");
  redirect(`/admin?einladung=${outcome}#lehrer`);
}

// Legt einen Lehrer-Zugang an und schickt eine Einladung. Das Passwort legt die Lehrkraft
// selbst ueber den Link fest; bis dahin ist das Konto mit einem unbekannten Zufallspasswort
// gesperrt.
export async function createTeacherAccount(formData: FormData) {
  await requireAdmin();

  const parsed = createTeacherSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
  });
  if (!parsed.success) redirect("/admin?einladung=ungueltig#lehrer");
  const normalizedEmail = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) redirect("/admin?einladung=vergeben#lehrer");

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const teacher = await prisma.user.create({
    data: { name: parsed.data.name, email: normalizedEmail, passwordHash, role: Role.TEACHER },
  });

  await inviteAndReport(teacher.id);
}

// Schickt einer Lehrkraft erneut einen Link zum Festlegen des Passworts (z. B. wenn die
// Einladung abgelaufen ist oder die E-Mail-Adresse geaendert wurde).
export async function resendTeacherInvite(formData: FormData) {
  await requireAdmin();
  const teacherId = z.string().cuid().parse(formData.get("teacherId"));
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, role: Role.TEACHER } });
  if (!teacher) throw new Error("Lehrer nicht gefunden.");
  await inviteAndReport(teacher.id);
}

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
