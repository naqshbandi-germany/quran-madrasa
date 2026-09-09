import type { NextAuthConfig } from "next-auth";

// Schlanke Basis-Konfiguration ohne den Credentials-Provider (der bcrypt und
// Prisma braucht). Wird von proxy.ts importiert, damit dort nur geprüft wird,
// ob eine gültige Session vorliegt, ohne die schwereren Server-Abhängigkeiten
// mitzuladen. Die jwt/session-Callbacks müssen dennoch hier liegen (nicht nur
// in src/auth.ts), da proxy.ts eine eigene NextAuth-Instanz nur aus dieser
// Config erzeugt – sonst fehlt "role" in der vom Proxy gesehenen Session.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/auth/signin",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as typeof session.user.role;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isProtected =
        nextUrl.pathname.startsWith("/dashboard") || nextUrl.pathname.startsWith("/teacher");
      if (!isProtected) return true;

      if (!auth?.user) return false;

      const isTeacherArea = nextUrl.pathname.startsWith("/teacher");
      if (isTeacherArea && auth.user.role !== "TEACHER" && auth.user.role !== "ADMIN") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
  },
};
