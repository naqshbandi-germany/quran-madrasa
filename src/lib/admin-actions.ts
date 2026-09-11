"use server";

import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session || session.user.role !== Role.ADMIN) {
    throw new Error("Nicht berechtigt.");
  }
  return session;
}

const createTeacherSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function createTeacherAccount(formData: FormData) {
  await requireAdmin();

  const parsed = createTeacherSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  const normalizedEmail = parsed.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw new Error("Diese E-Mail ist bereits registriert.");
  }

  const passwordHash = await bcrypt.hash(parsed.password, 10);
  await prisma.user.create({
    data: { name: parsed.name, email: normalizedEmail, passwordHash, role: Role.TEACHER },
  });

  revalidatePath("/admin");
}
