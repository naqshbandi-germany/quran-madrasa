import NextAuth from "next-auth";

import { authConfig } from "@/auth.config";

// In Next.js 16 heißt die Datei "proxy.ts" statt "middleware.ts". Die
// Zugriffsprüfung (eingeloggt? Rolle?) steckt im "authorized"-Callback in
// auth.config.ts.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/teacher/:path*", "/admin/:path*"],
};
