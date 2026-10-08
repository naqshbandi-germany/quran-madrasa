"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import type { ActionResult } from "@/lib/account-actions";
import { MAX_FILE_BYTES, formatBytes, mimeTypeFor, safeFileName, ALLOWED_EXTENSIONS } from "@/lib/media";
import { prisma } from "@/lib/prisma";

async function requireTeacher() {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  return session;
}

export async function uploadMediaFile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await requireTeacher();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, errors: { file: "Bitte wähle eine Datei aus." } };
  }
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      errors: { file: `Die Datei ist zu groß (${formatBytes(file.size)}). Erlaubt sind höchstens ${formatBytes(MAX_FILE_BYTES)}.` },
    };
  }

  const fileName = safeFileName(file.name);
  const mimeType = mimeTypeFor(fileName);
  if (!mimeType) {
    return {
      ok: false,
      errors: { file: `Dieser Dateityp ist nicht erlaubt. Erlaubt: ${ALLOWED_EXTENSIONS.join(", ")}.` },
    };
  }

  const data = Buffer.from(await file.arrayBuffer());
  // PDFs muessen auch wirklich eine PDF-Kopfzeile haben (verhindert falsch benannte Dateien).
  if (mimeType === "application/pdf" && data.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { ok: false, errors: { file: "Diese Datei ist keine gültige PDF-Datei." } };
  }

  const rawTitle = typeof formData.get("title") === "string" ? (formData.get("title") as string) : "";
  const title =
    rawTitle.trim().replace(/\s+/g, " ").slice(0, 120) || fileName.replace(/\.[A-Za-z0-9]{2,5}$/, "");

  await prisma.mediaFile.create({
    data: { ownerId: session.user.id, title, fileName, mimeType, sizeBytes: data.length, data },
  });

  revalidatePath("/teacher/mediathek");
  revalidatePath("/teacher/emails");
  return { ok: true, message: `„${title}“ wurde hochgeladen.` };
}

export async function deleteMediaFile(formData: FormData) {
  const session = await requireTeacher();
  const id = formData.get("fileId");
  if (typeof id !== "string") throw new Error("Ungültige Anfrage.");

  const file = await prisma.mediaFile.findUniqueOrThrow({ where: { id }, select: { id: true, ownerId: true } });
  if (session.user.role !== "ADMIN" && file.ownerId !== session.user.id) {
    throw new Error("Nicht berechtigt.");
  }

  await prisma.mediaFile.delete({ where: { id } });
  revalidatePath("/teacher/mediathek");
  revalidatePath("/teacher/emails");
}
