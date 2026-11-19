import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { streamMediaFile } from "@/lib/media-stream";
import { prisma } from "@/lib/prisma";
import { deleteSampleAudio } from "@/lib/reading-samples";
import { findSampleSource } from "@/lib/trial-samples";

async function loadSample(id: string) {
  return prisma.trialSample.findUnique({
    where: { id },
    include: {
      trialGuest: { select: { id: true, trialLesson: { select: { course: { select: { teacherId: true } } } } } },
      invitation: { select: { id: true, course: { select: { teacherId: true } } } },
    },
  });
}

// Wer darf die Hoerprobe abrufen bzw. loeschen? Der Gast bzw. Eingeladene ueber seinen Link
// (?t=...), die Lehrkraft des Kurses und Admins.
async function allowed(request: Request, sample: NonNullable<Awaited<ReturnType<typeof loadSample>>>) {
  const token = new URL(request.url).searchParams.get("t");
  if (token) {
    const source = await findSampleSource(token);
    const ownerId = source?.kind === "invitation" ? sample.invitation?.id : sample.trialGuest?.id;
    if (source && ownerId === source.id) return true;
  }
  const session = await auth();
  if (!session) return false;
  const teacherId = sample.trialGuest?.trialLesson.course.teacherId ?? sample.invitation?.course.teacherId;
  return session.user.role === "ADMIN" || session.user.id === teacherId;
}

// Spielt eine Hoerprobe zur Probestunde ab.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sample = await loadSample(id);
  if (!sample || !(await allowed(request, sample))) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }
  return streamMediaFile(
    {
      fileName: `hoerprobe-${sample.createdAt.toISOString().slice(0, 10)}`,
      mimeType: sample.mimeType,
      sizeBytes: sample.sizeBytes,
      data: sample.data,
      blobPathname: sample.blobPathname,
    },
    { inline: true, range: request.headers.get("range") },
  );
}

// Loescht eine Hoerprobe (Gast ueber seinen Link, Lehrkraft, Admin).
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sample = await loadSample(id);
  if (!sample || !(await allowed(request, sample))) {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }
  await deleteSampleAudio(sample);
  await prisma.trialSample.delete({ where: { id: sample.id } });
  return NextResponse.json({ ok: true });
}
