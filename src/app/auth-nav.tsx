"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";

export function AuthNav() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null;
  }

  if (!session) {
    return <Link href="/auth/signin">Anmelden</Link>;
  }

  return (
    <div className="flex items-center gap-4">
      {session.user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
      <span className="text-brand-600">{session.user.name}</span>
      <button onClick={() => signOut({ callbackUrl: "/" })} className="underline">
        Abmelden
      </button>
    </div>
  );
}
