import { NextResponse } from "next/server";
import Stripe from "stripe";

import { auth } from "@/auth";
import { getAppUrl } from "@/lib/app-url";
import { accessQuery } from "@/lib/course-access";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

// Ausweg, wenn die eingebettete Zahlung im Browser klemmt (z. B. automatisches Ausfuellen): dieselbe
// Zahlung auf der Stripe-Seite fortsetzen. Die eingebettete Session wird zuerst beendet, damit
// nicht zweimal bezahlt werden kann; Teilnehmer sind schon angelegt und stehen in den Metadaten.
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { sessionId?: unknown } | null;
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) {
    return NextResponse.json({ error: "Ungültige Eingaben." }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const embedded = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
    const metadata = embedded.metadata ?? {};
    if (metadata.userId !== session.user.id || embedded.mode !== "subscription") {
      return NextResponse.json({ error: "Zahlung nicht gefunden." }, { status: 404 });
    }
    if (embedded.status === "complete") return NextResponse.json({ url: "/dashboard?checkout=success" });
    if (embedded.status !== "open") {
      return NextResponse.json({ error: "Diese Zahlung ist abgelaufen. Bitte starte die Anmeldung neu." }, { status: 409 });
    }
    const course = await prisma.course.findUnique({ where: { id: metadata.courseId ?? "" } });
    const lineItems = (embedded.line_items?.data ?? []).flatMap((item) =>
      item.price ? [{ price: item.price.id, quantity: item.quantity ?? 1 }] : [],
    );
    const customer = typeof embedded.customer === "string" ? embedded.customer : embedded.customer?.id;
    if (!course || !customer || lineItems.length === 0) {
      return NextResponse.json({ error: "Zahlung nicht gefunden." }, { status: 404 });
    }

    // Schlaegt fehl, wenn gerade bezahlt wurde; dann entsteht keine zweite Zahlung.
    await stripe.checkout.sessions.expire(sessionId);

    const appUrl = getAppUrl();
    const query = accessQuery(course);
    const hosted = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: lineItems,
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/courses/${course.slug}/anmelden${query ? `${query}&` : "?"}checkout=cancelled`,
      metadata,
      subscription_data: { metadata },
    });
    return NextResponse.json({ url: hosted.url });
  } catch (err) {
    console.error("Wechsel zur Stripe-Seite fehlgeschlagen:", err);
    const message = err instanceof Stripe.errors.StripeError ? err.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: `Stripe-Fehler: ${message}` }, { status: 500 });
  }
}
