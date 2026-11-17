import { NextResponse, type NextRequest } from "next/server";

import { safeCallbackUrl } from "@/lib/safe-redirect";
import { VIEW_TIME_ZONE_COOKIE } from "@/lib/view-time-zone";

// Umschalter im Lehrer-Bereich: Zeiten in eigener Zeitzone ("lokal") oder in MEZ ("mez").
// Bewusst ein GET-Link statt einer Server-Aktion: Im Entwicklermodus "Ansehen als" sind alle
// Aenderungen (POST) gesperrt, die Anzeige soll sich dort aber trotzdem umschalten lassen.
export function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("modus") === "mez" ? "mez" : "lokal";
  const back = safeCallbackUrl(request.nextUrl.searchParams.get("zurueck"), "/teacher");
  const response = NextResponse.redirect(new URL(back, request.nextUrl));
  response.cookies.set(VIEW_TIME_ZONE_COOKIE, mode, {
    path: "/",
    maxAge: 365 * 24 * 3600,
    sameSite: "lax",
    httpOnly: true,
  });
  return response;
}
