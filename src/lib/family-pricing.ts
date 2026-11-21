import type Stripe from "stripe";

import { type FamilyTier } from "@/lib/family-tiers";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";

// Familienpreis fuer Kinderkurse: Alle Kurse mit familyPricing teilen sich einen gestaffelten
// Stripe-Preis (Tarifmodell "gestaffelt"/graduated). Eine Familie (Konto) hat dafuer genau ein
// Abo; jeder Kursplatz eines Kindes ist eine Einheit. Beispiel: 1. Platz 25 €, 2. und 3. je
// 20 €, ab dem 4. Platz 0 € (also 25 / 45 / 65 €). Die Staffel wird nur in Stripe gepflegt.

export { familyTierSummary, familyTotalCents, type FamilyTier } from "@/lib/family-tiers";

const tierCache = new Map<string, { at: number; tiers: FamilyTier[] | null }>();

// Staffel eines Stripe-Preises (10 Minuten zwischengespeichert). null, wenn der Preis nicht
// gestaffelt ist oder Stripe nicht erreichbar ist.
export async function loadFamilyTiers(priceId: string): Promise<FamilyTier[] | null> {
  const cached = tierCache.get(priceId);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.tiers;
  let tiers: FamilyTier[] | null = null;
  try {
    const price = await getStripe().prices.retrieve(priceId, { expand: ["tiers"] });
    if (price.billing_scheme === "tiered" && price.tiers_mode === "graduated" && price.tiers?.length) {
      tiers = price.tiers.map((t) => ({
        upTo: t.up_to ?? null,
        unitCents: t.unit_amount ?? Math.round(Number(t.unit_amount_decimal ?? 0)),
        flatCents: t.flat_amount ?? 0,
      }));
    }
  } catch (err) {
    console.error(`Staffel des Stripe-Preises ${priceId} konnte nicht geladen werden:`, err);
    return null;
  }
  tierCache.set(priceId, { at: Date.now(), tiers });
  return tiers;
}

const OPEN_STATUSES: Stripe.Subscription.Status[] = ["active", "trialing", "past_due"];

// Laufendes (nicht gekuendigtes) Familien-Abo eines Kontos fuer diesen Stripe-Preis.
export async function findFamilySubscription(userId: string, priceId: string) {
  const candidates = await prisma.subscription.findMany({
    where: { userId, family: true, status: { in: ["ACTIVE", "PAST_DUE"] }, cancelAtPeriodEnd: false },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { enrollments: true } } },
  });
  for (const local of candidates) {
    const remote = await getStripe()
      .subscriptions.retrieve(local.stripeSubscriptionId)
      .catch(() => null);
    const item = remote?.items.data.find((i) => i.price.id === priceId);
    if (remote && item && OPEN_STATUSES.includes(remote.status) && !remote.cancel_at_period_end) {
      return { local, remote, item, places: local._count.enrollments };
    }
  }
  return null;
}

// Belegte Plaetze im laufenden Familien-Abo (fuer die Anzeige bei der Anmeldung).
export async function familyPlacesInUse(userId: string) {
  const sub = await prisma.subscription.findFirst({
    where: { userId, family: true, status: { in: ["ACTIVE", "PAST_DUE"] }, cancelAtPeriodEnd: false },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { enrollments: true } } },
  });
  return sub?._count.enrollments ?? 0;
}
