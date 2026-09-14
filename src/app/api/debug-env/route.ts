import { NextResponse } from "next/server";

// Temporaerer Debug-Endpoint, um herauszufinden, warum Stripe die
// success_url ablehnt (vermutlich unsichtbare Zeichen in der
// NEXT_PUBLIC_APP_URL Env-Var). Nach dem Debuggen wieder entfernen.
export async function GET() {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? null;
  return NextResponse.json({
    raw,
    length: raw?.length ?? null,
    charCodes: raw ? [...raw].map((c) => c.charCodeAt(0)) : null,
  });
}
