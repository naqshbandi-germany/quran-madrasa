import { NextResponse } from "next/server";
import { z } from "zod";

import { requestPasswordReset } from "@/lib/password-reset";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }, { status: 400 });
  }

  await requestPasswordReset(parsed.data.email);

  // Immer dieselbe Antwort, egal ob es das Konto gibt.
  return NextResponse.json({ ok: true });
}
