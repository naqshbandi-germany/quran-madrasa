import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { streamMediaFile } from "@/lib/media-stream";
import { prisma } from "@/lib/prisma";
import { canAccessSample } from "@/lib/reading-samples";

// Spielt eine Leseprobe ab. Nur Konto-Inhaber des Teilnehmers, Lehrkraft des Kurses und Admin.
export async function GET(request: Request,{ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  const { id } = await params;

  const sample = await prisma.readingSample.findUnique({
    where: { id },
    include: {
      participant: { select: { ownerId: true } },
      course: { select: { teacherId: true } },
    },
  });
  if (!sample || !canAccessSample(session.user, sample)) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  return streamMediaFile(
    {
      fileName: `leseprobe-${sample.createdAt.toISOString().slice(0, 10)}`,
      mimeType: sample.mimeType,
      sizeBytes: sample.sizeBytes,
      data: sample.data,
      blobPathname: sample.blobPathname,
    },
    { inline: true, range: request.headers.get("range") },
  );
}
