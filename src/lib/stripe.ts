import Stripe from "stripe";

// Lazy statt eager erzeugt: Next.js wertet importierte Module schon beim
// "next build" aus ("Collecting page data"), nicht erst bei einer echten
// Anfrage - und der Stripe-Konstruktor wirft selbst bei leerem Key sofort.
// Ein fehlender Key wuerde so den kompletten Build blockieren statt nur die
// Route, die ihn tatsaechlich braucht.
let stripeInstance: Stripe | null = null;

export function getStripe() {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY ist nicht gesetzt (siehe .env.example)");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-08-26.dahlia",
    });
  }
  return stripeInstance;
}
