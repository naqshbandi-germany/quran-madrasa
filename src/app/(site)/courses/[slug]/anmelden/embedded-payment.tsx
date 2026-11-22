"use client";

import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

// Stripe.js nur einmal laden (ausserhalb der Komponente, sonst bei jedem Rendern neu).
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

// Zahlungsformular von Stripe direkt auf der Anmeldeseite (eingebetteter Checkout). Nach der
// Zahlung leitet Stripe auf die return_url der Checkout-Session weiter (Dashboard).
export function EmbeddedPayment({ clientSecret }: { clientSecret: string }) {
  if (!stripePromise) {
    return (
      <p className="border border-red-300 bg-red-50 p-4 text-sm text-red-900">
        Die Zahlung ist gerade nicht verfügbar (Stripe ist nicht eingerichtet). Bitte melde dich bei uns.
      </p>
    );
  }
  return (
    <div id="stripe-checkout" className="min-h-[420px] border border-gold-400/40 bg-white py-4">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
