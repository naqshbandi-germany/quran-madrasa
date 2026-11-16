"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE, isKnownTimeZone } from "@/lib/time-zones";

export type TimeZoneResult = { ok: boolean; message: string } | null;

// Lehrkraft (oder Admin) legt die eigene Zeitzone fest. Deutsche Zeit wird als "leer"
// gespeichert (Standard).
export async function updateOwnTimeZone(_prev: TimeZoneResult, formData: FormData): Promise<TimeZoneResult> {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    return { ok: false, message: "Nicht berechtigt." };
  }
  const value = String(formData.get("timeZone") ?? "");
  if (!isKnownTimeZone(value)) return { ok: false, message: "Bitte eine Zeitzone aus der Liste wählen." };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { timeZone: value === DEFAULT_TIME_ZONE ? null : value },
  });
  revalidatePath("/teacher", "layout");
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath("/quran");
  revalidatePath("/stundenplan");
  revalidatePath("/courses/[slug]", "page");
  return { ok: true, message: "Zeitzone gespeichert." };
}
