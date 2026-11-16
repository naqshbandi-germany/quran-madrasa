"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import sharp from "sharp";

import { auth } from "@/auth";
import type { ActionResult } from "@/lib/account-actions";
import { prisma } from "@/lib/prisma";
import { TEACHER_PHOTO_MAX_BYTES } from "@/lib/teacher-photo";

const PHOTO_SIZE = 512;

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== Role.ADMIN) throw new Error("Nicht berechtigt.");
}

function photoUrl(teacherId: string) {
  return `/api/lehrer/${teacherId}/foto?v=${Date.now()}`;
}

function done() {
  revalidatePath("/admin");
  revalidatePath("/lehrer");
}

// Foto hochladen: wird quadratisch auf 512 x 512 Pixel zugeschnitten, gedreht wie aufgenommen
// und ohne Metadaten (z. B. GPS-Position) als WebP gespeichert.
export async function uploadTeacherPhoto(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const teacherId = String(formData.get("teacherId") ?? "");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: { photo: "Bitte ein Foto auswählen." } };
  }
  if (file.size > TEACHER_PHOTO_MAX_BYTES) {
    return { ok: false, errors: { photo: "Das Foto ist zu groß (höchstens 4 MB)." } };
  }

  const teacher = await prisma.user.findUnique({
    where: { id: teacherId, role: Role.TEACHER },
    select: { id: true },
  });
  if (!teacher) return { ok: false, message: "Lehrkraft nicht gefunden." };

  let data: Buffer;
  try {
    data = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate()
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { ok: false, errors: { photo: "Diese Datei lässt sich nicht als Bild lesen. Bitte ein JPG, PNG oder WebP wählen." } };
  }

  await prisma.$transaction([
    prisma.teacherPhoto.upsert({
      where: { userId: teacher.id },
      create: { userId: teacher.id, mimeType: "image/webp", data },
      update: { mimeType: "image/webp", data },
    }),
    prisma.user.update({ where: { id: teacher.id }, data: { image: photoUrl(teacher.id) } }),
  ]);

  done();
  return { ok: true, message: "Foto gespeichert." };
}

export async function removeTeacherPhoto(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const teacherId = String(formData.get("teacherId") ?? "");
  await prisma.$transaction([
    prisma.teacherPhoto.deleteMany({ where: { userId: teacherId } }),
    prisma.user.updateMany({ where: { id: teacherId, role: Role.TEACHER }, data: { image: null } }),
  ]);

  done();
  return { ok: true, message: "Foto entfernt." };
}
