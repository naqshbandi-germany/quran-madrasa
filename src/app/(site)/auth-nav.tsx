"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function AuthNav({ className = "" }: { className?: string }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null;
  }

  if (!session) {
    return (
      <Link href="/auth/signin" className={className}>
        Anmelden
      </Link>
    );
  }

  const appAreaHref =
    session.user.role === "ADMIN" ? "/admin" : session.user.role === "TEACHER" ? "/teacher" : null;

  return (
    <div className={`flex flex-col gap-3 md:flex-row md:items-center md:gap-4 ${className}`}>
      {appAreaHref && <Link href={appAreaHref}>Verwaltung</Link>}
      <span className="text-white/70">{session.user.name}</span>
      <button onClick={() => signOut({ callbackUrl: "/" })} className="text-left underline">
        Abmelden
      </button>
    </div>
  );
}
