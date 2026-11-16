"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { VIEW_TIME_ZONE_COOKIE } from "@/lib/view-time-zone";

// Umschalter im Lehrer-Bereich: Zeiten in eigener Zeitzone ("lokal") oder in MEZ ("mez").
export async function setViewTimeZone(mode: "lokal" | "mez") {
  (await cookies()).set(VIEW_TIME_ZONE_COOKIE, mode === "mez" ? "mez" : "lokal", {
    path: "/",
    maxAge: 365 * 24 * 3600,
    sameSite: "lax",
    httpOnly: true,
  });
  revalidatePath("/teacher", "layout");
  revalidatePath("/admin", "layout");
}
