"use client";

import Link from "next/link";
import { useActionState } from "react";

import { confirmNewEmail, type ActionResult } from "@/lib/account-actions";

// change ist null, wenn der Link ungueltig ist. Nach dem Bestaetigen wird die Seite neu geladen und
// der Link ist verbraucht, der Erfolg steht dann im Zustand.
export function ConfirmEmailForm({
  token,
  change,
}: {
  token: string;
  change: { oldEmail: string; newEmail: string } | null;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(confirmNewEmail, { ok: false });

  if (state.ok) {
    return (
      <div className="space-y-4">
        <p role="status" className="bg-green-50 px-3 py-2 text-green-900">
          {state.message}
        </p>
        <Link href="/auth/signin" className="btn-primary btn-display inline-block px-5 py-2.5">
          Zur Anmeldung
        </Link>
      </div>
    );
  }
  if (!change) {
    return <p className="text-brand-900/85">Dieser Link ist ungültig, abgelaufen oder wurde schon benutzt.</p>;
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <p className="text-brand-900/85">
        Das Konto <strong className="text-brand-900">{change.oldEmail}</strong> bekommt die neue Adresse{" "}
        <strong className="text-brand-900">{change.newEmail}</strong>. Damit meldest du dich künftig an.
      </p>
      {state.message && (
        <p role="alert" className="bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary btn-display px-5 py-2.5 disabled:opacity-60">
        {pending ? "Einen Moment …" : "Neue Adresse bestätigen"}
      </button>
    </form>
  );
}
