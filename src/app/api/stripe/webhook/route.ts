import { NextResponse } from "next/server";
import Stripe from "stripe";

import { sendPaymentFailedNotice } from "@/lib/notification-email";
import { getStripe } from "@/lib/stripe";
import { syncSubscription } from "@/lib/subscription-sync";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Fehlende Signatur." }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: `Webhook-Signatur ungültig: ${message}` }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      if (checkoutSession.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          checkoutSession.subscription as string,
        );
        await syncSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscription(subscription);
      break;
    }
    case "invoice.payment_failed": {
      // Nur Verlaengerungen melden; beim ersten Checkout sieht der Nutzer den Fehler direkt.
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (customerId && invoice.billing_reason === "subscription_cycle") {
        const courseId = invoice.parent?.subscription_details?.metadata?.courseId ?? null;
        await sendPaymentFailedNotice(customerId, courseId);
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
