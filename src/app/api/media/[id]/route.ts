import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { streamMediaFile } from "@/lib/media-stream";
import { prisma } from "@/lib/prisma";

// Download einer Datei aus der Mediathek. Nur fuer Lehrer (eigene Dateien) und Admins.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Nicht berechtigt." }, { status: 401 });
  }

  const { id } = await params;
  const file = await prisma.mediaFile.findUnique({ where: { id } });
  if (!file || (session.user.role !== "ADMIN" && file.ownerId !== session.user.id)) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  return streamMediaFile(file);
}
