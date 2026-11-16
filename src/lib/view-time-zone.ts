import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE, teacherTimeZone } from "@/lib/time-zones";

// In welcher Zeitzone der Lehrer- bzw. Admin-Bereich Zeiten anzeigt und Eingaben versteht:
// in der eigenen Zeitzone (Lehrerprofil) oder, per Umschalter, in deutscher Zeit (MEZ/MESZ).
// Die Wahl steht in einem Cookie, damit Anzeige und Speichern dieselbe Zone verwenden.
export const VIEW_TIME_ZONE_COOKIE = "zeitanzeige";

export async function resolveViewTimeZone(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timeZone: true } });
  const ownTimeZone = teacherTimeZone(user);
  const mode = (await cookies()).get(VIEW_TIME_ZONE_COOKIE)?.value;
  const showingOwn = ownTimeZone === DEFAULT_TIME_ZONE || mode !== "mez";
  return { timeZone: showingOwn ? ownTimeZone : DEFAULT_TIME_ZONE, ownTimeZone, showingOwn };
}
