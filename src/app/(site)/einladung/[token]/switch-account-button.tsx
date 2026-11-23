"use client";

import { signOut } from "next-auth/react";

// Meldet das aktuelle Konto ab und kommt zur Einladung zurueck (dort: anmelden oder Konto anlegen).
export function SwitchAccountButton({ callbackUrl }: { callbackUrl: string }) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl })}
      className="btn-primary btn-display px-5 py-2.5"
    >
      Konto wechseln
    </button>
  );
}
