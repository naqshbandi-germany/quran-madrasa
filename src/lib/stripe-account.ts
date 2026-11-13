import Stripe from "stripe";

import { getStripe } from "@/lib/stripe";

export type StripeAccountStatus =
  | {
      ok: true;
      accountId: string;
      accountName: string;
      livemode: boolean;
      // Preis-IDs der Kurse, die es im verbundenen Konto nicht gibt (z. B. aus dem alten Konto).
      missingPriceIds: string[];
    }
  | { ok: false; error: string };

function isMissing(err: unknown) {
  return err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing";
}

// Zeigt im Admin-Bereich, mit welchem Stripe-Konto die Website gerade abrechnet. Nach einem
// Kontowechsel faellt so sofort auf, wenn auf Vercel noch der Schluessel des alten Kontos aktiv
// ist (Variable nur fuer Preview geaendert, kein Redeploy, Schluessel aus dem falschen Konto
// kopiert) oder bei Kursen noch Preis-IDs aus dem alten Konto stehen.
export async function getStripeAccountStatus(priceIds: string[]): Promise<StripeAccountStatus> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { ok: false, error: "STRIPE_SECRET_KEY ist nicht gesetzt." };

  try {
    const stripe = getStripe();
    const account = await stripe.accounts.retrieveCurrent();
    const accountName =
      account.settings?.dashboard?.display_name ||
      account.business_profile?.name ||
      account.email ||
      "(ohne Namen)";

    const unique = [...new Set(priceIds.filter(Boolean))];
    const missingPriceIds: string[] = [];
    await Promise.all(
      unique.map(async (id) => {
        try {
          await stripe.prices.retrieve(id);
        } catch (err) {
          if (isMissing(err)) missingPriceIds.push(id);
          else throw err;
        }
      }),
    );

    return {
      ok: true,
      accountId: account.id,
      accountName,
      livemode: key.startsWith("sk_live_") || key.startsWith("rk_live_"),
      missingPriceIds: missingPriceIds.sort(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return { ok: false, error: message };
  }
}
