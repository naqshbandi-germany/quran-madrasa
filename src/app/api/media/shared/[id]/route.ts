import { NextResponse } from "next/server";

import { verifyMediaLink } from "@/lib/media-links";
import { streamMediaFile } from "@/lib/media-stream";
import { prisma } from "@/lib/prisma";

// Download ueber einen befristeten, signierten Link (so schicken wir grosse Dateien per E-Mail).
// Ohne gueltige Signatur oder nach Ablauf antwortet die Seite mit 404.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  if (!verifyMediaLink(id, url.searchParams.get("e"), url.searchParams.get("s"))) {
    return NextResponse.json({ error: "Der Link ist ungültig oder abgelaufen." }, { status: 404 });
  }

  const file = await prisma.mediaFile.findUnique({ where: { id } });
  if (!file) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });

  return streamMediaFile(file);
}
