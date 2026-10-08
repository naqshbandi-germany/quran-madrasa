import { NextResponse } from "next/server";

import { auth } from "@/auth";
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

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
