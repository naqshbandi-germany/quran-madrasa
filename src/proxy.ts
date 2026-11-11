import NextAuth from "next-auth";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { authConfig } from "@/auth.config";

// In Next.js 16 heißt die Datei "proxy.ts" statt "middleware.ts". Sie erledigt zwei Dinge:
// 1. Vorschau-Schutz: Ist SITE_PREVIEW_CODE gesetzt, sehen Besucher ohne Vorschau-Freigabe auf
//    den öffentlichen Seiten nur eine "Bald verfügbar"-Seite. Freigabe per Link
//    "?vorschau=<code>" (setzt ein Cookie). Versteckte Kurse (/zugang/...), Anmeldung, Login,
//    Dashboard sowie Lehrer- und Admin-Bereich bleiben erreichbar, damit Testnutzer und Team
//    weiterarbeiten können.
// 2. Zugriffsprüfung (eingeloggt? Rolle?) über den "authorized"-Callback in auth.config.ts.

// Mit (request, event) aufgerufen verhaelt sich auth() wie die Middleware von Auth.js
// ("export { auth as default }"); die Typen kennen diese Ueberladung fuer NextRequest nicht.
const authMiddleware = NextAuth(authConfig).auth as unknown as (
  request: NextRequest,
  event: NextFetchEvent,
) => Promise<Response>;

const PREVIEW_COOKIE = "vorschau";
const PREVIEW_PARAM = "vorschau";

const AUTH_PREFIXES = ["/dashboard", "/teacher", "/admin", "/konto"];

// Diese Pfade sind auch ohne Vorschau-Freigabe erreichbar.
const OPEN_PREFIXES = [
  "/bald",
  "/zugang/",
  "/auth/",
  "/api/",
  "/dashboard",
  "/teacher",
  "/admin",
  "/konto",
  "/impressum",
  "/datenschutz",
  "/bildnachweis",
  "/lehrer",
];

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix.replace(/\/$/, "") || pathname.startsWith(prefix));
}

// Die Anmeldung zu einem versteckten Kurs (/courses/<kurs>/anmelden?zugang=...) bleibt offen.
function isOpenPath(pathname: string) {
  return startsWithAny(pathname, OPEN_PREFIXES) || /^\/courses\/[^/]+\/anmelden$/.test(pathname);
}

function previewGate(request: NextRequest) {
  const code = process.env.SITE_PREVIEW_CODE?.trim();
  if (!code) return null;

  const { nextUrl } = request;

  // Freigabe-Link: Cookie setzen und ohne den Parameter weiterleiten.
  const given = nextUrl.searchParams.get(PREVIEW_PARAM);
  if (given !== null) {
    const target = nextUrl.clone();
    target.searchParams.delete(PREVIEW_PARAM);
    const response = NextResponse.redirect(target);
    if (given === code) {
      response.cookies.set(PREVIEW_COOKIE, code, {
        httpOnly: true,
        secure: nextUrl.protocol === "https:",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 180,
        path: "/",
      });
    }
    return response;
  }

  if (request.cookies.get(PREVIEW_COOKIE)?.value === code) return null;
  if (isOpenPath(nextUrl.pathname)) return null;

  const response = NextResponse.rewrite(new URL("/bald", nextUrl));
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  const gated = previewGate(request);
  if (gated) return gated;

  if (startsWithAny(request.nextUrl.pathname, AUTH_PREFIXES)) {
    return authMiddleware(request, event);
  }
  return NextResponse.next();
}

export const config = {
  // Alle Seiten ausser statischen Dateien (alles mit Punkt im Pfad) und Next-internen Assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
