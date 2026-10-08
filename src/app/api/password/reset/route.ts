import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { passwordMeetsRules } from "@/lib/password-rules";
import { hashResetToken } from "@/lib/password-reset";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  token: z.string().min(32).max(200),
  password: z.string().refine(passwordMeetsRules),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Eingaben." }, { status: 400 });
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(parsed.data.token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Dieser Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    // Alle offenen Links dieses Kontos entwerten
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
