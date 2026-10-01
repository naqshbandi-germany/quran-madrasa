"use client";

import { signOut } from "next-auth/react";

export function AppSignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className="text-brand-700 underline">
      Abmelden
    </button>
  );
}
