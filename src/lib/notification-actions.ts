"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { typesForRole } from "@/lib/notification-types";
import { prisma } from "@/lib/prisma";

async function requireStaff() {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  return session;
}

function refresh() {
  revalidatePath("/teacher", "layout");
  revalidatePath("/admin", "layout");
}

export async function markNotificationRead(formData: FormData) {
  const session = await requireStaff();
  const id = String(formData.get("id") ?? "");
  const unread = formData.get("unread") === "1";
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { readAt: unread ? null : new Date() },
  });
  refresh();
}

export async function markAllNotificationsRead() {
  const session = await requireStaff();
  await prisma.notification.updateMany({
    where: { userId: session.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  refresh();
}

export type PreferencesResult = { ok: boolean; message: string } | null;

export async function saveNotificationPreferences(
  _prev: PreferencesResult,
  formData: FormData,
): Promise<PreferencesResult> {
  const session = await requireStaff();
  const types = typesForRole(session.user.role);
  await prisma.$transaction(
    types.map((type) => {
      const email = formData.get(`email_${type}`) === "on";
      return prisma.notificationPreference.upsert({
        where: { userId_type: { userId: session.user.id, type } },
        create: { userId: session.user.id, type, email },
        update: { email },
      });
    }),
  );
  refresh();
  return { ok: true, message: "Einstellungen gespeichert." };
}
