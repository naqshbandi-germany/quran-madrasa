import { NextResponse } from "next/server";

import { VIEW_AS_COOKIE, VIEW_AS_INFO_COOKIE } from "@/lib/view-as";

// Beendet den Entwicklermodus ("Ansehen als") und fuehrt zurueck in den Admin-Bereich. Bewusst
// GET, weil waehrend der Ansicht alle anderen Anfragen gesperrt sind (src/proxy.ts).
export function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.delete(VIEW_AS_COOKIE);
  response.cookies.delete(VIEW_AS_INFO_COOKIE);
  return response;
}
