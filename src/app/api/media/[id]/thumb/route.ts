import { NextResponse } from "next/server";
import sharp from "sharp";

import { auth } from "@/auth";
import { openBlob } from "@/lib/blob";
import { prisma } from "@/lib/prisma";

// Bilder groesser als das werden nicht verkleinert (Vorschau faellt auf ein Symbol zurueck).
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

// Kleines Vorschaubild einer Bilddatei fuer die Mediathek-Ansicht. Nur fuer Lehrer (eigene
// Dateien) und Admins.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  const { id } = await params;
  const file = await prisma.mediaFile.findUnique({ where: { id } });
  if (
    !file ||
    !file.mimeType.startsWith("image/") ||
    file.sizeBytes > MAX_SOURCE_BYTES ||
    (session.user.role !== "ADMIN" && file.ownerId !== session.user.id)
  ) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  try {
    let source: Buffer;
    if (file.blobPathname) {
      const blob = await openBlob(file.blobPathname);
      if (!blob?.stream) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
      source = Buffer.from(await new Response(blob.stream).arrayBuffer());
    } else if (file.data) {
      source = Buffer.from(file.data);
    } else {
      return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
    }

    const thumb = await sharp(source)
      .rotate()
      .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer();

    return new Response(new Uint8Array(thumb), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("Vorschaubild fehlgeschlagen:", err);
    return NextResponse.json({ error: "Keine Vorschau." }, { status: 404 });
  }
}
