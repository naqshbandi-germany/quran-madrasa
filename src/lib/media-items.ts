import { shouldSendAsLink } from "@/lib/media";

// Schlanke Beschreibung einer Mediathek-Datei fuer die Oberflaeche (ohne den Inhalt).
export type MediaItem = {
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  ownerName?: string;
  // Gross genug, um in E-Mails als Download-Link statt als Anhang zu gehen
  asLink: boolean;
};

export type MediaKind = "image" | "pdf" | "audio" | "doc";

export function mediaKindOf(mimeType: string): MediaKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("audio/")) return "audio";
  return "doc";
}

export const MEDIA_KIND_LABELS: Record<MediaKind, string> = {
  image: "Bild",
  pdf: "PDF",
  audio: "Audio",
  doc: "Dokument",
};

export function toMediaItem(
  file: {
    id: string;
    title: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date;
    blobPathname: string | null;
    owner?: { name: string } | null;
  },
): MediaItem {
  return {
    id: file.id,
    title: file.title,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt.toISOString(),
    ownerName: file.owner?.name,
    asLink: shouldSendAsLink(file),
  };
}
