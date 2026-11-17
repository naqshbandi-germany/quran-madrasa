import { NextResponse } from "next/server";

import { formatBytes } from "@/lib/media";
import { recordEvent } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import {
  READING_SAMPLE_MAX_BYTES,
  READING_SAMPLE_MAX_SECONDS,
  normalizeAudioType,
  storeSampleAudio,
} from "@/lib/reading-samples";
import { findGuestBySampleToken } from "@/lib/trial-samples";

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

// Nimmt die Hoerprobe eines Probestunden-Gastes entgegen (ohne Konto, ueber den persoenlichen
// Link). Hoechstens 3 Aufnahmen pro Gast, damit der Link nicht als Ablage missbraucht wird.
const MAX_SAMPLES_PER_GUEST = 3;

export async function POST(request: Request) {
  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });

  const guest = await findGuestBySampleToken(field(formData, "token"));
  if (!guest) return NextResponse.json({ error: "Dieser Link ist nicht (mehr) gültig." }, { status: 404 });
  if (formData.get("consent") !== "on") {
    return NextResponse.json({ error: "Bitte bestätige den Hinweis zum Datenschutz." }, { status: 400 });
  }
  if (guest.samples.length >= MAX_SAMPLES_PER_GUEST) {
    return NextResponse.json(
      { error: `Du hast schon ${MAX_SAMPLES_PER_GUEST} Aufnahmen geschickt. Lösche eine, wenn du eine neue senden möchtest.` },
      { status: 400 },
    );
  }

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

  try {
    const stored = await storeSampleAudio({
      ownerId: `probestunde-${guest.id}`,
      mimeType,
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    const sample = await prisma.trialSample.create({
      data: {
        trialGuestId: guest.id,
        mimeType,
        sizeBytes: file.size,
        durationSec,
        note,
        consentAt: new Date(),
        ...stored,
      },
      select: { id: true },
    });
    const course = guest.trialLesson.course;
    await recordEvent({
      type: "READING_SAMPLE_UPLOADED",
      dedupeKey: `trial-sample:${sample.id}`,
      courseId: course.id,
      data: { course: course.title, participants: [guest.name], note: note ?? undefined, trial: true },
    });
  } catch (err) {
    console.error("Hörprobe zur Probestunde konnte nicht gespeichert werden:", err);
    return NextResponse.json({ error: "Die Aufnahme konnte nicht gespeichert werden." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
