import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { formatBytes } from "@/lib/media";
import { prisma } from "@/lib/prisma";
import {
  READING_SAMPLE_MAX_BYTES,
  READING_SAMPLE_MAX_SECONDS,
  normalizeAudioType,
  storeSampleAudio,
} from "@/lib/reading-samples";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Nimmt eine Leseprobe entgegen (Aufnahme im Browser oder hochgeladene Datei). Nur der
// Konto-Inhaber eines im Kurs eingeschriebenen Teilnehmers darf hochladen.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Es wurde keine Aufnahme übermittelt." }, { status: 400 });
  }
  if (file.size > READING_SAMPLE_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Die Aufnahme ist zu groß (${formatBytes(file.size)}). Erlaubt sind höchstens ${formatBytes(READING_SAMPLE_MAX_BYTES)}, also etwa ${READING_SAMPLE_MAX_SECONDS / 60} Minuten.`,
      },
      { status: 400 },
    );
  }
  const mimeType = normalizeAudioType(file.type);
  if (!mimeType) {
    return NextResponse.json({ error: "Bitte nur Audiodateien hochladen (z. B. m4a, mp3, webm)." }, { status: 400 });
  }

  const participantId = field(formData, "participantId");
  const courseId = field(formData, "courseId");
  const sessionId = field(formData, "sessionId") || null;
  const note = field(formData, "note").slice(0, 500) || null;
  const rawDuration = Number(field(formData, "durationSec"));
  const durationSec =
    Number.isFinite(rawDuration) && rawDuration > 0 ? Math.min(Math.round(rawDuration), 24 * 3600) : null;
  if (durationSec && durationSec > READING_SAMPLE_MAX_SECONDS + 5) {
    return NextResponse.json(
      { error: `Die Aufnahme ist zu lang. Erlaubt sind höchstens ${READING_SAMPLE_MAX_SECONDS / 60} Minuten.` },
      { status: 400 },
    );
  }

  const enrollment = await prisma.enrollment.findFirst({
    where: { participantId, courseId, participant: { ownerId: session.user.id } },
    select: { id: true },
  });
  if (!enrollment) {
    return NextResponse.json({ error: "Dieser Teilnehmer ist nicht in diesem Kurs." }, { status: 403 });
  }
  if (sessionId) {
    const classSession = await prisma.classSession.findFirst({ where: { id: sessionId, courseId }, select: { id: true } });
    if (!classSession) return NextResponse.json({ error: "Unbekannte Stunde." }, { status: 400 });
  }

  try {
    const stored = await storeSampleAudio({
      ownerId: session.user.id,
      mimeType,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    await prisma.readingSample.create({
      data: {
        participantId,
        courseId,
        sessionId,
        mimeType,
        sizeBytes: file.size,
        durationSec,
        note,
        ...stored,
      },
    });
  } catch (err) {
    console.error("Leseprobe konnte nicht gespeichert werden:", err);
    return NextResponse.json({ error: "Die Aufnahme konnte nicht gespeichert werden." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
