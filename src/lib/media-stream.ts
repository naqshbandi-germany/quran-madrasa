import { NextResponse } from "next/server";

import { openBlob } from "@/lib/blob";

type StreamableFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  data: Uint8Array | null;
  blobPathname: string | null;
};

// Liest "bytes=start-end" aus dem Range-Header. Nur ein einzelner Bereich wird unterstuetzt.
function parseRange(header: string, size: number): { start: number; end: number } | "invalid" | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (match[1] === "" && match[2] === "")) return null;
  let start: number;
  let end: number;
  if (match[1] === "") {
    // "bytes=-500": die letzten 500 Bytes
    start = Math.max(0, size - Number(match[2]));
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}

async function readAll(stream: ReadableStream<Uint8Array>) {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Liefert eine Mediathek-Datei als Download aus (aus der Datenbank oder aus Vercel Blob).
// Mit `range` (Range-Header der Anfrage) wird bei Bedarf ein Teilbereich mit Status 206
// geliefert. Safari/iOS spielt Audio und Video nur ab, wenn der Server das beherrscht. Dafuer
// wird die ganze Datei gepuffert, also nur fuer kleine Dateien (z. B. Leseproben) verwenden.
export async function streamMediaFile(
  file: StreamableFile,
  options: { inline?: boolean; range?: string | null } = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": file.mimeType,
    "Content-Disposition": `${options.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };

  if (options.range !== undefined) {
    let bytes: Uint8Array<ArrayBuffer> | null =file.data ? new Uint8Array(file.data) : null;
    if (!bytes && file.blobPathname) {
      const blob = await openBlob(file.blobPathname);
      if (blob && blob.statusCode === 200 && blob.stream) bytes = await readAll(blob.stream);
    }
    if (!bytes) return NextResponse.json({ error: "Datei nicht gefunden." }, { status: 404 });

    const size = bytes.byteLength;
    headers["Accept-Ranges"] = "bytes";
    const range = options.range ? parseRange(options.range, size) : null;
    if (range === "invalid") {
      return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    }
    if (range) {
      return new Response(bytes.slice(range.start, range.end + 1), {
        status: 206,
        headers: {
          ...headers,
          "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
          "Content-Length": String(range.end - range.start + 1),
        },
      });
    }
    return new Response(bytes, { headers: { ...headers, "Content-Length": String(size) } });
  }

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
