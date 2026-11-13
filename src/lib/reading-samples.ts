import { put } from "@vercel/blob";

import { blobAccess, deleteBlob, isBlobConfigured } from "@/lib/blob";
import { prisma } from "@/lib/prisma";

// Leseproben: kurze Audioaufnahmen, die nur die Lehrkraft (und der Admin) sowie der
// Konto-Inhaber des Teilnehmers abrufen koennen.
export const READING_SAMPLE_MAX_SECONDS = 5 * 60;
// Vercel-Funktionen nehmen hoechstens ca. 4,5 MB pro Anfrage an. Browser-Aufnahmen mit
// 48 kbit/s brauchen fuer 5 Minuten rund 1,8 MB.
export const READING_SAMPLE_MAX_BYTES = 4 * 1024 * 1024;
export const READING_SAMPLE_RETENTION_DAYS = 180;

// Container-Typen ohne Codec-Zusatz (MediaRecorder liefert z. B. "audio/webm;codecs=opus").
const ALLOWED: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};
export const READING_SAMPLE_ACCEPT = Object.keys(ALLOWED).join(",");

export function normalizeAudioType(type: string) {
  const base = type.split(";")[0].trim().toLowerCase();
  return ALLOWED[base] ? base : null;
}

type Viewer = { id: string; role: string };

// Wer darf eine Leseprobe hoeren? Konto-Inhaber des Teilnehmers, Lehrkraft des Kurses, Admin.
export function canAccessSample(
  viewer: Viewer,
  sample: { participant: { ownerId: string }; course: { teacherId: string } },
) {
  return (
    viewer.role === "ADMIN" ||
    viewer.id === sample.participant.ownerId ||
    viewer.id === sample.course.teacherId
  );
}

export function canReviewSample(viewer: Viewer, sample: { course: { teacherId: string } }) {
  return viewer.role === "ADMIN" || viewer.id === sample.course.teacherId;
}

// Speichert die Aufnahme in Vercel Blob (falls eingerichtet), sonst in der Datenbank.
export async function storeSampleAudio(params: {
  ownerId: string;
  mimeType: string;
  bytes: Buffer;
}): Promise<{ data: Buffer | null; blobPathname: string | null }> {
  if (!isBlobConfigured()) return { data: params.bytes, blobPathname: null };
  const ext = ALLOWED[params.mimeType] ?? "audio";
  const result = await put(`leseproben/${params.ownerId}/aufnahme.${ext}`, params.bytes, {
    access: blobAccess(),
    addRandomSuffix: true,
    contentType: params.mimeType,
  });
  return { data: null, blobPathname: result.pathname };
}

export async function deleteSampleAudio(sample: { blobPathname: string | null }) {
  if (sample.blobPathname) await deleteBlob(sample.blobPathname);
}

// Loescht Leseproben nach Ablauf der Aufbewahrungsfrist (vom Erinnerungs-Cron aufgerufen).
export async function deleteExpiredSamples() {
  const cutoff = new Date(Date.now() - READING_SAMPLE_RETENTION_DAYS * 24 * 3600 * 1000);
  const expired = await prisma.readingSample.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, blobPathname: true },
    take: 200,
  });
  for (const sample of expired) await deleteSampleAudio(sample);
  if (expired.length > 0) {
    await prisma.readingSample.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } });
  }
  return expired.length;
}
