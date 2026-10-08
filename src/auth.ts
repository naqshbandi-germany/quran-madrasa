import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { authConfig } from "@/auth.config";
import { isGoogleAuthConfigured } from "@/lib/auth-providers";
import { prisma } from "@/lib/prisma";

const baseJwt = authConfig.callbacks!.jwt!;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "E-Mail & Passwort",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: (credentials.email as string).toLowerCase() },
        });
        if (!user) return null;

        const isValid = await bcrypt.compare(credentials.password as string, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
    // Nur aktiv, wenn AUTH_GOOGLE_ID und AUTH_GOOGLE_SECRET gesetzt sind.
    ...(isGoogleAuthConfigured()
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Google-Konten: nur mit bestaetigter E-Mail-Adresse; beim ersten Login wird ein
    // Schueler-Konto angelegt (ohne nutzbares Passwort, das laesst sich ueber "Passwort
    // vergessen" jederzeit setzen).
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      const email = profile?.email?.toLowerCase();
      if (!email || !profile?.email_verified) return false;

      const existing = await prisma.user.findUnique({ where: { email } });
      if (!existing) {
        const now = new Date();
        await prisma.user.create({
          data: {
            name: profile.name?.trim() || email.split("@")[0],
            email,
            passwordHash: await bcrypt.hash(randomBytes(32).toString("hex"), 10),
            role: Role.STUDENT,
            image: typeof profile.picture === "string" ? profile.picture : null,
            adultConfirmedAt: now,
            privacyAcknowledgedAt: now,
          },
        });
      }
      return true;
    },
    // Bei Google ist user.id die Google-Kennung; fuer die Sitzung brauchen wir die ID und
    // Rolle aus unserer Datenbank.
    async jwt(params) {
      if (params.account?.provider === "google" && params.token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: params.token.email.toLowerCase() },
        });
        if (dbUser) {
          params.token.id = dbUser.id;
          params.token.role = dbUser.role;
        }
        return params.token;
      }
      return baseJwt(params);
    },
  },
});
