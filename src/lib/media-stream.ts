import { NextResponse } from "next/server";

import { openBlob } from "@/lib/blob";

type StreamableFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Uint8Array | null;
  blobPathname: string | null;
};

// Liefert eine Mediathek-Datei als Download aus (aus der Datenbank oder aus Vercel Blob).
export async function streamMediaFile(file: StreamableFile) {
  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (file.blobPathname) {
    const blob = await openBlob(file.blobPathname);
    if (!blob || blob.statusCode !== 200 || !blob.stream) {
      return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
    }
    return new Response(blob.stream, { headers: { ...headers, "Content-Length": String(file.sizeBytes) } });
  }

  if (!file.data) return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });
  return new Response(new Uint8Array(file.data), { headers: { ...headers, "Content-Length": String(file.sizeBytes) } });
}
