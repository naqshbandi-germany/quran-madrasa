import { createHmac, timingSafeEqual } from "node:crypto";

import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { deleteSampleAudio, READING_SAMPLE_RETENTION_DAYS } from "@/lib/reading-samples";
import { SAMPLE_WHEN, sampleBlockHtml } from "@/lib/sample-block";

// Hoerproben ohne Konto: Ein Probestunden-Gast oder jemand, der zu einem Kurs eingeladen wurde,
// bekommt einen persoenlichen Link, ueber den er eine Aufnahme macht oder hochlaedt. Die
// Lehrkraft hoert sie unter "Termine" (Probestunde) bzw. unter "Hörproben" im Kurs (Einladung).

export function trialSamplePath(token: string) {
  return `/probestunde/hoerprobe/${token}`;
}

export function invitationSamplePath(token: string) {
  return `/einladung/hoerprobe/${token}`;
}

function secret() {
  const value = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET ist nicht gesetzt.");
  return value;
}

function signature(scope: "hoerprobe" | "einladung-hoerprobe", id: string) {
  return createHmac("sha256", secret()).update(`${scope}:${id}`).digest("base64url").slice(0, 32);
}

// Persoenlicher Link eines Gastes: "<Gast-ID>-<Signatur>" (die ID enthaelt keinen Bindestrich). Er laesst sich jederzeit neu
// erzeugen (Einladung, Erinnerung), ohne ihn zu speichern.
export function trialSampleToken(guestId: string) {
  return `${guestId}-${signature("hoerprobe", guestId)}`;
}

// Link zur Kurseinladung: "i_<Einladungs-ID>-<Signatur>" (eigener Schluessel, damit sich die
// beiden Arten nicht verwechseln lassen).
export function invitationSampleToken(invitationId: string) {
  return `i_${invitationId}-${signature("einladung-hoerprobe", invitationId)}`;
}

function parseToken(token: string): { kind: "trial" | "invitation"; id: string } | null {
  const kind = token.startsWith("i_") ? "invitation" : "trial";
  const rest = kind === "invitation" ? token.slice(2) : token;
  const cut = rest.indexOf("-");
  const id = rest.slice(0, cut);
  const sig = rest.slice(cut + 1);
  if (cut < 1 || !sig || id.length > 40 || !/^[a-z0-9]+$/.test(id)) return null;
  const expected = Buffer.from(signature(kind === "invitation" ? "einladung-hoerprobe" : "hoerprobe", id));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? { kind, id } : null;
}

const SAMPLE_SELECT = {
  orderBy: { createdAt: "desc" },
  select: { id: true, createdAt: true, durationSec: true, note: true, listenedAt: true },
} as const;
const COURSE_SELECT = { select: { id: true, title: true, teacherId: true, teacher: { select: { name: true } } } } as const;

export type SampleSource = {
  kind: "trial" | "invitation";
  // ID des Gastes bzw. der Einladung
  id: string;
  name: string;
  sampleRequest: string;
  // Beginn der Probestunde (nur bei kind "trial")
  startsAt: Date | null;
  course: { id: string; title: string; teacherId: string; teacher: { name: string } };
  samples: { id: string; createdAt: Date; durationSec: number | null; note: string | null; listenedAt: Date | null }[];
};

// Gast bzw. Einladung zum Link; null, wenn der Link ungueltig ist, die Probestunde abgesagt
// oder lange vorbei bzw. die Einladung lange abgelaufen ist.
export async function findSampleSource(token: string | null | undefined): Promise<SampleSource | null> {
  const parsed = token && token.length < 100 ? parseToken(token) : null;
  if (!parsed) return null;
  const week = 7 * 86_400_000;

  if (parsed.kind === "invitation") {
    const invitation = await prisma.invitation.findUnique({
      where: { id: parsed.id },
      include: { course: COURSE_SELECT, samples: SAMPLE_SELECT },
    });
    if (!invitation?.sampleRequest) return null;
    // Bis eine Woche nach Ablauf der Einladung nutzbar.
    if (invitation.expiresAt.getTime() < Date.now() - week) return null;
    return {
      kind: "invitation",
      id: invitation.id,
      name: invitation.name ?? "",
      sampleRequest: invitation.sampleRequest,
      startsAt: null,
      course: invitation.course,
      samples: invitation.samples,
    };
  }

  const guest = await prisma.trialGuest.findUnique({
    where: { id: parsed.id },
    include: {
      trialLesson: { select: { startsAt: true, canceledAt: true, course: COURSE_SELECT } },
      samples: SAMPLE_SELECT,
    },
  });
  if (!guest || !guest.sampleRequest || guest.trialLesson.canceledAt) return null;
  // Nach der Probestunde noch eine Woche nutzbar (z. B. fuer eine zweite Aufnahme).
  if (guest.trialLesson.startsAt.getTime() < Date.now() - week) return null;
  return {
    kind: "trial",
    id: guest.id,
    name: guest.name,
    sampleRequest: guest.sampleRequest,
    startsAt: guest.trialLesson.startsAt,
    course: guest.trialLesson.course,
    samples: guest.samples,
  };
}

// Baustein fuer Einladung und Erinnerung ({{hoerprobe}}); leer ohne Bitte.
export function trialSampleHtml(sampleRequest: string | null | undefined, token: string | null | undefined) {
  if (!sampleRequest || !token) return "";
  return sampleBlockHtml(sampleRequest, `${getAppUrl()}${trialSamplePath(token)}`, SAMPLE_WHEN.trial);
}

export function trialSampleShareText(sampleRequest: string | null | undefined, token: string | null | undefined) {
  if (!sampleRequest || !token) return "";
  return ` Bitte nimm vorher eine kurze Hörprobe auf (${sampleRequest}), damit sich die Lehrkraft vorbereiten kann: ${getAppUrl()}${trialSamplePath(token)}`;
}

// Dasselbe fuer die Einladung zu einem Kurs (Aufnahme auch schon vor der Anmeldung).
export function invitationSampleHtml(sampleRequest: string | null | undefined, token: string | null | undefined) {
  if (!sampleRequest || !token) return "";
  return sampleBlockHtml(sampleRequest, `${getAppUrl()}${invitationSamplePath(token)}`, SAMPLE_WHEN.invitation);
}

export function invitationSampleShareText(sampleRequest: string | null | undefined, token: string | null | undefined) {
  if (!sampleRequest || !token) return "";
  return ` Bitte nimm außerdem eine kurze Hörprobe auf (${sampleRequest}), gern schon vor der Anmeldung, damit sich die Lehrkraft vorbereiten kann: ${getAppUrl()}${invitationSamplePath(token)}`;
}

// Hat sich ein Probestunden-Gast oder Eingeladener mit derselben E-Mail-Adresse zum Kurs
// angemeldet, werden seine Hoerproben dem Teilnehmer zugeordnet (dann auch im Schuelerprofil
// sichtbar). Mit invitationId auch ohne E-Mail-Adresse (Einladung per Link).
export async function adoptTrialSamples(courseId: string, participantIds: string[], invitationId?: string | null) {
  if (participantIds.length === 0) return 0;
  const participants = await prisma.participant.findMany({
    where: { id: { in: participantIds } },
    select: { id: true, email: true, relation: true, owner: { select: { email: true } } },
  });
  let moved = 0;
  for (const [index, p] of participants.entries()) {
    // Kinder ohne eigene Adresse: keine Zuordnung ueber die Adresse der Eltern.
    const email = (p.email ?? (p.relation === "CHILD" ? null : p.owner.email))?.trim();
    const sameEmail = email ? ({ equals: email, mode: "insensitive" } as const) : null;
    const or = [
      ...(sameEmail
        ? [{ trialGuest: { email: sameEmail, trialLesson: { courseId } } }, { invitation: { email: sameEmail, courseId } }]
        : []),
      // Ueber den Einladungslink angemeldet: Hoerproben dieser Einladung gehen an den ersten Teilnehmer.
      ...(invitationId && index === 0 ? [{ invitationId, invitation: { courseId } }] : []),
    ];
    if (or.length === 0) continue;
    const samples = await prisma.trialSample.findMany({ where: { OR: or } });
    for (const s of samples) {
      const fallback = s.invitationId ? "Hörprobe zur Einladung" : "Hörprobe zur Probestunde";
      const prefix = s.invitationId ? "Einladung" : "Probestunde";
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
            note: s.note ? `${prefix}: ${s.note}` : fallback,
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
export async function adoptTrialSamplesSafely(courseId: string, participantIds: string[], invitationId?: string | null) {
  try {
    await adoptTrialSamples(courseId, participantIds, invitationId);
  } catch (err) {
    console.error("Hörproben ohne Konto konnten nicht zugeordnet werden:", err);
  }
}

// Loescht Hoerproben ohne Konto nach Ablauf der Aufbewahrungsfrist (vom Cron aufgerufen).
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
