import Stripe from "stripe";

import { getStripe } from "@/lib/stripe";

// Liefert das Abo aus dem aktuell verbundenen Stripe-Konto oder null, wenn es dort nicht existiert
// (Abo aus einem frueheren Stripe-Konto oder aus dem Test- statt Live-Modus). Solche Abos lassen
// sich von hier aus nicht kuendigen; das muss im alten Konto von Hand geschehen.
export async function retrieveSubscriptionIfPresent(id: string) {
  try {
    return await getStripe().subscriptions.retrieve(id);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") {
      return null;
    }
    throw err;
  }
}
