"use server";

import { head } from "@vercel/blob";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import type { ActionResult } from "@/lib/account-actions";
import { blobPathPrefix, deleteBlob, isBlobConfigured, openBlob } from "@/lib/blob";
import {
  ALLOWED_EXTENSIONS,
  MAX_BLOB_FILE_BYTES,
  MAX_FILE_BYTES,
  formatBytes,
  mimeTypeFor,
  safeFileName,
} from "@/lib/media";
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

// Traegt eine Datei ein, die der Browser bereits direkt in den Blob-Speicher geladen hat. Die
// Angaben des Browsers werden gegen den Speicher geprueft (Pfad, Typ, Groesse).
async function registerBlobFileUnsafe(input: {
  pathname: string;
  fileName: string;
  title: string;
}): Promise<ActionResult> {
  const session = await requireTeacher();
  if (!isBlobConfigured()) return { ok: false, message: "Der Blob-Speicher ist nicht eingerichtet." };

  const fileName = safeFileName(input.fileName);
  const mimeType = mimeTypeFor(fileName);
  const prefix = blobPathPrefix(session.user.id);
  if (!mimeType || typeof input.pathname !== "string" || !input.pathname.startsWith(prefix)) {
    if (typeof input.pathname === "string" && input.pathname.startsWith(prefix)) await deleteBlob(input.pathname);
    return { ok: false, errors: { file: "Dieser Dateityp ist nicht erlaubt." } };
  }

  let meta;
  try {
    meta = await head(input.pathname);
  } catch {
    return { ok: false, message: "Die hochgeladene Datei wurde im Speicher nicht gefunden. Bitte lade sie erneut hoch." };
  }
  if (meta.size > MAX_BLOB_FILE_BYTES) {
    await deleteBlob(input.pathname);
    return { ok: false, errors: { file: `Die Datei ist zu groß (${formatBytes(meta.size)}).` } };
  }

  // PDFs muessen eine PDF-Kopfzeile haben.
  if (mimeType === "application/pdf") {
    try {
      const blob = await openBlob(input.pathname);
      const reader = blob?.stream?.getReader();
      const first = reader ? (await reader.read()).value : undefined;
      await reader?.cancel();
      if (!first || Buffer.from(first.subarray(0, 5)).toString("latin1") !== "%PDF-") {
        await deleteBlob(input.pathname);
        return { ok: false, errors: { file: "Diese Datei ist keine gültige PDF-Datei." } };
      }
    } catch {
      await deleteBlob(input.pathname);
      return { ok: false, message: "Die Datei konnte nicht geprüft werden. Bitte lade sie erneut hoch." };
    }
  }

  const title =
    (typeof input.title === "string" ? input.title : "").trim().replace(/\s+/g, " ").slice(0, 120) ||
    fileName.replace(/\.[A-Za-z0-9]{2,5}$/, "");

  await prisma.mediaFile.create({
    data: {
      ownerId: session.user.id,
      title,
      fileName,
      mimeType,
      sizeBytes: meta.size,
      blobPathname: meta.pathname,
      blobUrl: meta.url,
    },
  });

  revalidatePath("/teacher/mediathek");
  revalidatePath("/teacher/emails");
  return { ok: true, message: `„${title}“ wurde hochgeladen.` };
}

export async function registerBlobFile(input: {
  pathname: string;
  fileName: string;
  title: string;
}): Promise<ActionResult> {
  try {
    return await registerBlobFileUnsafe(input);
  } catch (err) {
    console.error("Eintragen der Blob-Datei fehlgeschlagen:", err);
    const detail = err instanceof Error && err.message ? ` (${err.message})` : "";
    return { ok: false, message: `Die Datei wurde hochgeladen, konnte aber nicht eingetragen werden.${detail}` };
  }
}

export async function deleteMediaFile(formData: FormData) {
  const session = await requireTeacher();
  const id = formData.get("fileId");
  if (typeof id !== "string") throw new Error("Ungültige Anfrage.");

  const file = await prisma.mediaFile.findUniqueOrThrow({
    where: { id },
    select: { id: true, ownerId: true, blobPathname: true },
  });
  if (session.user.role !== "ADMIN" && file.ownerId !== session.user.id) {
    throw new Error("Nicht berechtigt.");
  }

  if (file.blobPathname) await deleteBlob(file.blobPathname);
  await prisma.mediaFile.delete({ where: { id } });
  revalidatePath("/teacher/mediathek");
  revalidatePath("/teacher/emails");
}
