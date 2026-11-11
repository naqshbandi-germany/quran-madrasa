import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

// Prueft, ob die gespeicherte Stripe-Kunden-ID im aktuell verbundenen Stripe-Konto existiert.
// Nach einem Wechsel des Stripe-Kontos (oder von Test- auf Live-Modus) gehoeren alte IDs zu
// einem anderen Konto; dann wird die ID verworfen.
export async function existingStripeCustomerId(stripeCustomerId: string | null) {
  if (!stripeCustomerId) return null;
  try {
    const customer = await getStripe().customers.retrieve(stripeCustomerId);
    return customer.deleted ? null : customer.id;
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") {
      return null;
    }
    throw err;
  }
}

// Liefert die Stripe-Kunden-ID des Kontos im aktuellen Stripe-Konto und legt den Kunden bei
// Bedarf (neu) an.
export async function ensureStripeCustomer(user: {
  id: string;
  name: string;
  email: string;
  stripeCustomerId: string | null;
}) {
  const current = await existingStripeCustomerId(user.stripeCustomerId);
  if (current) return current;

  const customer = await getStripe().customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}
