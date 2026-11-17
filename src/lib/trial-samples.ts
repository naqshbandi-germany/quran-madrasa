import { createHmac, timingSafeEqual } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { escapeHtml } from "@/lib/html";
import { prisma } from "@/lib/prisma";
import { deleteSampleAudio, READING_SAMPLE_RETENTION_DAYS } from "@/lib/reading-samples";

// Hoerproben zur Probestunde: Der Gast bekommt einen persoenlichen Link (ohne Konto), ueber
// den er eine Aufnahme macht oder hochlaedt. Die Lehrkraft hoert sie unter "Termine".

export function trialSamplePath(token: string) {
  return `/probestunde/hoerprobe/${token}`;
}

function secret() {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET ist nicht gesetzt.");
  return value;
}

function signature(guestId: string) {
  return createHmac("sha256", secret()).update(`hoerprobe:${guestId}`).digest("base64url").slice(0, 32);
}

// Persoenlicher Link eines Gastes: "<Gast-ID>-<Signatur>" (die ID enthaelt keinen Bindestrich). Er laesst sich jederzeit neu
// erzeugen (Einladung, Erinnerung), ohne ihn zu speichern.
export function trialSampleToken(guestId: string) {
  return `${guestId}-${signature(guestId)}`;
}

function guestIdFromToken(token: string) {
  const cut = token.indexOf("-");
  const guestId = token.slice(0, cut);
  const sig = token.slice(cut + 1);
  if (cut < 1 || !sig || guestId.length > 40 || !/^[a-z0-9]+$/.test(guestId)) return null;
  const expected = Buffer.from(signature(guestId));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? guestId : null;
}

// Gast zum Link; null, wenn der Link ungueltig ist, die Probestunde abgesagt oder lange vorbei.
export async function findGuestBySampleToken(token: string | null | undefined) {
  const guestId = token && token.length < 100 ? guestIdFromToken(token) : null;
  if (!guestId) return null;
  const guest = await prisma.trialGuest.findUnique({
    where: { id: guestId },
    include: {
      trialLesson: {
        select: {
          id: true,
          startsAt: true,
          canceledAt: true,
          course: { select: { id: true, title: true, teacherId: true, teacher: { select: { name: true } } } },
        },
      },
      samples: {
        orderBy: { createdAt: "desc" },
        select: { id: true, createdAt: true, durationSec: true, note: true, listenedAt: true },
      },
    },
  });
  if (!guest || !guest.sampleRequest || guest.trialLesson.canceledAt) return null;
  // Nach der Probestunde noch eine Woche nutzbar (z. B. fuer eine zweite Aufnahme).
  if (guest.trialLesson.startsAt.getTime() < Date.now() - 7 * 86_400_000) return null;
  return guest;
}

// Baustein fuer Einladung und Erinnerung ({{hoerprobe}}); leer ohne Bitte.
export function trialSampleHtml(sampleRequest: string | null | undefined, token: string | null | undefined) {
  if (!sampleRequest || !token) return "";
  const url = `${getAppUrl()}${trialSamplePath(token)}`;
  return `
      <div style="margin: 24px 0; padding: 12px 16px; background: #f4f1e8; border-left: 3px solid #b8963e;">
        <p style="margin: 0 0 8px;"><strong>Hörprobe erbeten:</strong> ${escapeHtml(sampleRequest)}</p>
        <p style="margin: 0 0 12px; font-size: 14px;">
          Bitte lies den Abschnitt vor der Probestunde laut vor und nimm ihn auf. Die Lehrkraft hört ihn
          sich an und kann sich so gezielt vorbereiten. Ein Konto brauchst du dafür nicht.
        </p>
        <a href="${escapeHtml(url)}" style="color: #1d6347; font-weight: bold;">Hörprobe aufnehmen</a>
      </div>`;
}

export function trialSampleShareText(sampleRequest: string | null | undefined, token: string | null | undefined) {
  if (!sampleRequest || !token) return "";
  return ` Bitte nimm vorher eine kurze Hörprobe auf (${sampleRequest}), damit sich die Lehrkraft vorbereiten kann: ${getAppUrl()}${trialSamplePath(token)}`;
}

// Hat sich ein Probestunden-Gast mit derselben E-Mail-Adresse zum Kurs angemeldet, werden
// seine Hoerproben dem Teilnehmer zugeordnet (dann auch im Schuelerprofil sichtbar).
export async function adoptTrialSamples(courseId: string, participantIds: string[]) {
  if (participantIds.length === 0) return 0;
  const participants = await prisma.participant.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, email: true, relation: true, owner: { select: { email: true } } },
  });
  let moved = 0;
  for (const p of participants) {
    // Kinder ohne eigene Adresse: keine Zuordnung ueber die Adresse der Eltern.
    const email = (p.email ?? (p.relation === "CHILD" ? null : p.owner.email))?.trim();
    if (!email) continue;
    const samples = await prisma.trialSample.findMany({
      where: {
        trialGuest: { email: { equals: email, mode: "insensitive" }, trialLesson: { courseId } },
      },
    });
    for (const s of samples) {
      await prisma.$transaction([
        prisma.readingSample.create({
          data: {
            participantId: p.id,
            courseId,
            mimeType: s.mimeType,
            sizeBytes: s.sizeBytes,
            durationSec: s.durationSec,
            data: s.data,
            blobPathname: s.blobPathname,
            note: s.note ? `Probestunde: ${s.note}` : "Hörprobe zur Probestunde",
            listenedAt: s.listenedAt,
            createdAt: s.createdAt,
          },
        }),
        prisma.trialSample.delete({ where: { id: s.id } }),
      ]);
      moved++;
    }
  }
  return moved;
}

// Zuordnung darf die Anmeldung nie scheitern lassen.
export async function adoptTrialSamplesSafely(courseId: string, participantIds: string[]) {
  try {
    await adoptTrialSamples(courseId, participantIds);
  } catch (err) {
    console.error("Hörproben der Probestunde konnten nicht zugeordnet werden:", err);
  }
}

// Loescht Hoerproben von Probestunden nach Ablauf der Aufbewahrungsfrist (vom Cron aufgerufen).
export async function deleteExpiredTrialSamples() {
  const cutoff = new Date(Date.now() - READING_SAMPLE_RETENTION_DAYS * 86_400_000);
  const expired = await prisma.trialSample.findMany({
    where: { createdAt: { lt: cutoff } },
    select: { id: true, blobPathname: true },
    take: 200,
  });
  for (const s of expired) await deleteSampleAudio(s);
  if (expired.length > 0) await prisma.trialSample.deleteMany({ where: { id: { in: expired.map((s) => s.id) } } });
  return expired.length;
}
