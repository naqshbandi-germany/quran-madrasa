import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import { findFamilySubscription } from "@/lib/family-pricing";
import { findValidInvitation } from "@/lib/invitations";
import { sendEnrollmentConfirmation } from "@/lib/notification-email";
import { recordEvent } from "@/lib/notifications";
import { fullName } from "@/lib/names";
import { adoptTrialSamplesSafely } from "@/lib/trial-samples";

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
import { accessQuery, canAccessCourse } from "@/lib/course-access";
import { getCourseCapacity } from "@/lib/course-capacity";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { ensureStripeCustomer } from "@/lib/stripe-customer";

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
    muslimName: asString(value.muslimName),
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
// Kinderkurse mit Familienpreis: Hat das Konto schon ein Familien-Abo, werden die Plaetze dort
// dazugebucht (gestaffelter Preis, anteilige Rechnung sofort) und die Teilnehmer gleich
// eingeschrieben; sonst entsteht ueber Stripe Checkout ein neues Familien-Abo.
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

  // Einladung "ohne Zahlung" (von einem Admin): Teilnehmer werden direkt eingetragen.
  const invitationToken = asString(body?.invitationToken);
  const invitation = invitationToken ? await findValidInvitation(invitationToken) : null;
  const freeInvitation =
    invitation && course && invitation.courseId === course.id && invitation.freeEnrollment ? invitation : null;
  if (invitationToken && !freeInvitation) {
    return NextResponse.json(
      { error: "Die Einladung ist nicht mehr gültig (abgelaufen oder schon benutzt)." },
      { status: 400 },
    );
  }

  if (!course || !canAccessCourse(course, asString(body?.accessCode)) || (!course.stripePriceId && !freeInvitation)) {
    return NextResponse.json({ error: "Kurs nicht verfügbar." }, { status: 400 });
  }

  // Teilnehmerbegrenzung: voller Kurs -> keine Zahlung, nur Warteliste.
  const capacity = await getCourseCapacity(course.id, course.maxParticipants);
  if (capacity.isFull) {
    return NextResponse.json(
      { error: "Dieser Kurs ist leider ausgebucht. Du kannst dich auf der Kursseite auf die Warteliste setzen." },
      { status: 409 },
    );
  }
  if (capacity.free != null && total > capacity.free) {
    return NextResponse.json(
      {
        error:
          capacity.free === 1
            ? "In diesem Kurs ist nur noch 1 Platz frei. Bitte melde nur 1 Teilnehmer an."
            : `In diesem Kurs sind nur noch ${capacity.free} Plätze frei. Bitte melde höchstens ${capacity.free} Teilnehmer an.`,
      },
      { status: 409 },
    );
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

  // Familienpreis: Die Anmeldeseite hat den Preis mit der bisherigen Platzzahl im Familien-Abo
  // angezeigt. Hat sich die Zahl inzwischen geaendert, erst neu laden (kein unerwarteter Preis).
  const familySub =
    course.familyPricing && course.stripePriceId && !freeInvitation
      ? await findFamilySubscription(user.id, course.stripePriceId)
      : null;
  if (course.familyPricing && !freeInvitation && (familySub?.places ?? 0) !== Number(body?.familyPlaces ?? 0)) {
    return NextResponse.json(
      { error: "Dein Familien-Abo hat sich gerade geändert. Bitte lade die Seite neu, damit du den aktuellen Preis siehst." },
      { status: 409 },
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
      input.muslimName = user.muslimName ?? "";
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
          muslimName: p.muslimName,
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

  if (freeInvitation) {
    // Einladung genau einmal einloesen (auch bei zwei gleichzeitigen Klicks).
    const claimed = await prisma.invitation.updateMany({
      where: { id: freeInvitation.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) {
      return NextResponse.json({ error: "Diese Einladung wurde schon benutzt." }, { status: 400 });
    }
    const enrollments = await prisma.$transaction(
      participantIds.map((participantId) =>
        prisma.enrollment.create({
          data: { userId: user.id, participantId, courseId: course.id },
          select: { id: true },
        }),
      ),
    );
    revalidatePath("/courses/[slug]", "page");
    revalidatePath("/");
    await adoptTrialSamplesSafely(course.id, participantIds, freeInvitation.id);
    try {
      await sendEnrollmentConfirmation(course.id, enrollments.map((e) => e.id));
    } catch (err) {
      console.error("Bestätigungs-Mail nach kostenloser Anmeldung fehlgeschlagen:", err);
    }
    return NextResponse.json({ url: "/dashboard" });
  }

  // Ab hier nur mit Stripe-Preis (oben geprueft, da ohne Einladung Pflicht).
  const stripePriceId = course.stripePriceId!;

  if (familySub) {
    try {
      // Plaetze dazubuchen: Stripe rechnet die Staffel neu und stellt den Unterschied fuer den
      // Rest des Monats sofort anteilig in Rechnung (mit einer Anmeldegebuehr, falls vorhanden).
      await getStripe().subscriptions.update(familySub.remote.id, {
        items: [{ id: familySub.item.id, quantity: familySub.places + participantIds.length }],
        proration_behavior: "always_invoice",
        ...(course.signupFeePriceId
          ? { add_invoice_items: [{ price: course.signupFeePriceId, quantity: participantIds.length }] }
          : {}),
      });
    } catch (err) {
      console.error("Familien-Abo konnte nicht erweitert werden:", err);
      const message = err instanceof Stripe.errors.StripeError ? err.message : "Unbekannter Fehler.";
      return NextResponse.json({ error: `Stripe-Fehler: ${message}` }, { status: 500 });
    }
    const enrollments = await prisma.$transaction(
      participantIds.map((participantId) =>
        prisma.enrollment.create({
          data: { userId: user.id, participantId, courseId: course.id, subscriptionId: familySub.local.id },
          select: { id: true, participant: { select: { name: true, muslimName: true } } },
        }),
      ),
    );
    await prisma.subscription.update({
      where: { id: familySub.local.id },
      data: { quantity: familySub.places + participantIds.length },
    });
    revalidatePath("/courses/[slug]", "page");
    revalidatePath("/");
    await adoptTrialSamplesSafely(course.id, participantIds);
    await recordEvent({
      type: "ENROLLMENT_CREATED",
      dedupeKey: `enrollment:${enrollments.map((e) => e.id).sort().join(",")}`,
      courseId: course.id,
      participantId: participantIds.length === 1 ? participantIds[0] : null,
      data: { course: course.title, owner: user.name, participants: enrollments.map((e) => fullName(e.participant)) },
    });
    try {
      await sendEnrollmentConfirmation(course.id, enrollments.map((e) => e.id));
    } catch (err) {
      console.error("Bestätigungs-Mail nach Erweiterung des Familien-Abos fehlgeschlagen:", err);
    }
    return NextResponse.json({ url: "/dashboard?checkout=success" });
  }

  try {
    const stripe = getStripe();
    const stripeCustomerId = await ensureStripeCustomer(user);

    const appUrl = getAppUrl();
    const query = accessQuery(course);
    const cancelUrl = `${appUrl}/courses/${course.slug}/anmelden${query ? `${query}&` : "?"}checkout=cancelled`;
    const metadata = {
      userId: user.id,
      courseId: course.id,
      // Hoechstens 10 IDs (je 25 Zeichen) und damit unter dem Stripe-Limit von 500 Zeichen.
      participantIds: participantIds.join(","),
      // Familien-Abo: spaeter koennen Plaetze in weiteren Familienpreis-Kursen dazukommen.
      ...(course.familyPricing ? { family: "1" } : {}),
    };

    // Eingebetteter Checkout: Stripe zeigt das Zahlungsformular auf unserer Anmeldeseite
    // (siehe enroll-wizard.tsx). Nach der Zahlung leitet Stripe auf return_url weiter.
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      ui_mode: "embedded_page",
      customer: stripeCustomerId,
      // Optional: einmalige Anmeldegebuehr pro Teilnehmer, faellig mit der ersten Rechnung.
      line_items: [
        { price: stripePriceId, quantity: participantIds.length },
        ...(course.signupFeePriceId
          ? [{ price: course.signupFeePriceId, quantity: participantIds.length }]
          : []),
      ],
      return_url: `${appUrl}/dashboard?checkout=success`,
      metadata,
      subscription_data: { metadata },
    });

    // cancelUrl: "Zurück" im Wizard laedt die Anmeldeseite neu (die eben angelegten Teilnehmer
    // sind dann gespeichert und werden nicht doppelt angelegt).
    return NextResponse.json({ clientSecret: checkoutSession.client_secret, cancelUrl });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    const message = err instanceof Stripe.errors.StripeError ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Stripe-Fehler: ${message}` }, { status: 500 });
  }
}
