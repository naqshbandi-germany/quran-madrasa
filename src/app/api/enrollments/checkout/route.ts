import { NextResponse } from "next/server";
import Stripe from "stripe";

import { auth } from "@/auth";
import { getAppUrl } from "@/lib/app-url";
import {
  MAX_PARTICIPANTS_PER_ORDER,
  type CleanParticipant,
  validateParticipant,
  type ParticipantErrors,
  type ParticipantInput,
  type ParticipantRelationValue,
} from "@/lib/participant-rules";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

const RELATIONS: ParticipantRelationValue[] = ["SELF", "CHILD", "OTHER"];

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseNewParticipant(raw: unknown): ParticipantInput | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const relation = RELATIONS.find((r) => r === value.relation);
  if (!relation) return null;
  return {
    relation,
    name: asString(value.name),
    email: asString(value.email),
    birthYear: asString(value.birthYear),
    whatsapp: asString(value.whatsapp),
    whatsappConsent: value.whatsappConsent === true,
    consentConfirmed: value.consentConfirmed === true,
  };
}

// Legt neue Teilnehmer an (falls angegeben) und startet die Stripe-Zahlung fuer den Kurs.
// Der Konto-Inhaber bezahlt ein Abo mit einer Position pro Teilnehmer; die Einschreibung
// erfolgt erst nach erfolgreicher Zahlung ueber den Webhook (lib/subscription-sync.ts).
export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const courseId = asString(body?.courseId);
  const existingIds = Array.isArray(body?.existingParticipantIds)
    ? [...new Set((body.existingParticipantIds as unknown[]).map(asString).filter(Boolean))]
    : [];
  const rawNew = Array.isArray(body?.newParticipants) ? (body.newParticipants as unknown[]) : [];

  const total = existingIds.length + rawNew.length;
  if (total < 1) {
    return NextResponse.json({ error: "Bitte wähle mindestens einen Teilnehmer aus." }, { status: 400 });
  }
  if (total > MAX_PARTICIPANTS_PER_ORDER) {
    return NextResponse.json(
      { error: `Pro Anmeldung sind höchstens ${MAX_PARTICIPANTS_PER_ORDER} Teilnehmer möglich.` },
      { status: 400 },
    );
  }

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !course.isPublished || !course.stripePriceId) {
    return NextResponse.json({ error: "Kurs nicht verfügbar." }, { status: 400 });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });

  // Bestehende Teilnehmer muessen diesem Konto gehoeren und duerfen noch nicht im Kurs sein.
  const existing = await prisma.participant.findMany({
    where: { id: { in: existingIds }, ownerId: user.id },
    include: { enrollments: { where: { courseId: course.id }, select: { id: true } } },
  });
  if (existing.length !== existingIds.length) {
    return NextResponse.json({ error: "Ein ausgewählter Teilnehmer wurde nicht gefunden." }, { status: 400 });
  }
  const alreadyIn = existing.filter((p) => p.enrollments.length > 0).map((p) => p.name);
  if (alreadyIn.length > 0) {
    return NextResponse.json(
      { error: `Schon in diesem Kurs angemeldet: ${alreadyIn.join(", ")}.` },
      { status: 400 },
    );
  }

  // Neue Teilnehmer pruefen. "Ich selbst" nimmt Name und E-Mail immer aus dem Konto.
  const hasSelf = (await prisma.participant.count({ where: { ownerId: user.id, relation: "SELF" } })) > 0;
  const fieldErrors: Record<number, ParticipantErrors> = {};
  const cleaned: CleanParticipant[] = [];
  for (const [index, raw] of rawNew.entries()) {
    const input = parseNewParticipant(raw);
    if (!input) {
      return NextResponse.json({ error: "Ungültige Eingaben." }, { status: 400 });
    }
    if (input.relation === "SELF") {
      if (hasSelf || cleaned.some((c) => c.relation === "SELF")) {
        return NextResponse.json({ error: "Du bist bereits als Teilnehmer angelegt." }, { status: 400 });
      }
      input.name = user.name;
      input.email = user.email;
    }
    const { errors, clean } = validateParticipant(input);
    if (!clean) fieldErrors[index] = errors;
    else cleaned.push(clean);
  }
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: "Bitte prüfe die markierten Felder.", fieldErrors },
      { status: 400 },
    );
  }

  const now = new Date();
  const created = await prisma.$transaction(
    cleaned.map((p) =>
      prisma.participant.create({
        data: {
          ownerId: user.id,
          name: p.name,
          relation: p.relation,
          birthYear: p.birthYear,
          email: p.email,
          whatsapp: p.whatsapp,
          whatsappConsentAt: p.whatsappConsent ? now : null,
          consentConfirmedAt: p.consentConfirmed ? now : null,
        },
        select: { id: true },
      }),
    ),
  );

  const participantIds = [...existing.map((p) => p.id), ...created.map((p) => p.id)];

  try {
    const stripe = getStripe();
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: user.id },
      });
      stripeCustomerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId } });
    }

    const appUrl = getAppUrl();
    const metadata = {
      userId: user.id,
      courseId: course.id,
      // Hoechstens 10 IDs (je 25 Zeichen) und damit unter dem Stripe-Limit von 500 Zeichen.
      participantIds: participantIds.join(","),
    };

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: course.stripePriceId, quantity: participantIds.length }],
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/courses/${course.slug}/anmelden?checkout=cancelled`,
      metadata,
      subscription_data: { metadata },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    const message = err instanceof Stripe.errors.StripeError ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Stripe-Fehler: ${message}` }, { status: 500 });
  }
}
