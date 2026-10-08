import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { passwordMeetsRules } from "@/lib/password-rules";
import { prisma } from "@/lib/prisma";

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().refine(passwordMeetsRules),
  // Pflicht-Bestaetigungen, deren Zeitpunkt gespeichert wird
  adultConfirmed: z.literal(true),
  privacyAcknowledged: z.literal(true),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingaben." }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "Diese E-Mail ist bereits registriert." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const now = new Date();

  await prisma.user.create({
    data: {
      name,
      email: normalizedEmail,
      passwordHash,
      role: Role.STUDENT,
      adultConfirmedAt: now,
      privacyAcknowledgedAt: now,
    },
  });

  return NextResponse.json({ ok: true });
}
