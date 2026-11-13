"use server";

import { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { realAuth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { VIEW_AS_COOKIE, VIEW_AS_INFO_COOKIE, VIEW_AS_MAX_AGE, type ViewAsInfo } from "@/lib/view-as";

// Startet den Entwicklermodus: Der Admin sieht die Website ab jetzt als die gewaehlte Person
// (Lehrer -> Lehrer-Bereich, Schueler -> "Meine Kurse"). Beenden ueber VIEW_AS_EXIT_PATH.
export async function startViewAs(formData: FormData) {
  const session = await realAuth();
  if (session?.user.role !== Role.ADMIN) throw new Error("Nicht berechtigt.");

  const userId = z.string().cuid().parse(formData.get("userId"));
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!target || target.role === Role.ADMIN) throw new Error("Diese Person lässt sich nicht ansehen.");

  const info: ViewAsInfo = { name: target.name, email: target.email, role: target.role };
  const store = await cookies();
  const options = {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: VIEW_AS_MAX_AGE,
    path: "/",
  };
  store.set(VIEW_AS_COOKIE, target.id, { ...options, httpOnly: true });
  // Next kodiert den Wert selbst (URL-Kodierung); der Browser liest ihn mit decodeURIComponent.
  store.set(VIEW_AS_INFO_COOKIE, JSON.stringify(info), options);

  redirect(target.role === Role.TEACHER ? "/teacher" : "/dashboard");
}
