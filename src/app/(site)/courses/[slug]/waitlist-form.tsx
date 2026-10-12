"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { CheckboxField } from "@/components/form/checkbox-field";
import { FloatingField } from "@/components/form/floating-field";
import type { ActionResult } from "@/lib/account-actions";
import { joinWaitlist } from "@/lib/waitlist-actions";

const INITIAL: ActionResult = { ok: false };

// Eintragen in die Warteliste eines ausgebuchten Kurses (ohne Konto, ohne Zahlung).
export function WaitlistForm({ courseId }: { courseId: string }) {
  // Kontrollierte Felder, damit die Eingaben den Formular-Reset nach der Aktion ueberleben.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await joinWaitlist(prev, formData);
    if (result.ok) {
      setName("");
      setEmail("");
      setConsent(false);
    }
    return result;
  }, INITIAL);

  if (state.ok) {
    return (
      <div role="status" className="border border-azure-200 bg-azure-50 p-4 text-sm text-azure-900">
        <p className="font-semibold">Du stehst auf der Warteliste.</p>
        <p className="mt-1">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="courseId" value={courseId} />
      {/* Honeypot gegen Bots: fuer Menschen unsichtbar */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FloatingField
          id="wl-name"
          name="name"
          label="Name"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={state.errors?.name}
        />
        <FloatingField
          id="wl-email"
          name="email"
          type="email"
          label="E-Mail"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={state.errors?.email}
        />
      </div>
      <CheckboxField
        id="wl-consent"
        name="consent"
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        error={state.errors?.consent}
      >
        Ich bin damit einverstanden, dass meine Angaben zur Benachrichtigung über freie Plätze
        gespeichert werden (
        <Link href="/datenschutz" className="text-azure-800 underline underline-offset-2">
          Datenschutz
        </Link>
        ).
      </CheckboxField>
      {state.message && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {state.message}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary btn-display w-full px-4 py-2.5 disabled:opacity-60">
        {pending ? "Wird eingetragen …" : "Auf die Warteliste setzen"}
      </button>
    </form>
  );
}
