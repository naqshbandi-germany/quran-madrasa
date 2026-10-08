"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { FloatingField } from "@/components/form/floating-field";
import { FormAlert } from "@/components/form/form-alert";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!EMAIL_PATTERN.test(email.trim())) {
      setEmailError("Bitte gib deine E-Mail-Adresse ein, z. B. name@beispiel.de.");
      document.getElementById("forgot-email")?.focus();
      return;
    }
    setEmailError(null);

    setLoading(true);
    try {
      const response = await fetch("/api/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) throw new Error();
      setSent(true);
    } catch {
      setFormError("Das hat nicht geklappt. Bitte versuche es in einem Moment noch einmal.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-4xl font-semibold text-brand-900">Passwort vergessen?</h1>

      {sent ? (
        <div role="status" className="mt-6 space-y-3 rounded-md border border-brand-200 bg-white p-5">
          <p className="font-medium text-brand-900">Prüfe dein Postfach.</p>
          <p className="text-sm text-brand-900/80">
            Wenn es zu <strong>{email.trim()}</strong> ein Konto gibt, haben wir dir einen Link zum
            Zurücksetzen geschickt. Er ist 60 Minuten gültig. Schau bei Bedarf auch im
            Spam-Ordner nach.
          </p>
          <Link href="/auth/signin" className="inline-block text-sm font-medium text-azure-800 underline">
            Zurück zur Anmeldung
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-2 text-brand-900/75">
            Gib die E-Mail-Adresse deines Kontos ein. Wir schicken dir einen Link, mit dem du ein
            neues Passwort festlegst.
          </p>
          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <FormAlert>{formError}</FormAlert>
            <FloatingField
              id="forgot-email"
              name="email"
              type="email"
              label="E-Mail-Adresse"
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              error={emailError}
            />
            <button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-md bg-brand-600 px-4 font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700 disabled:opacity-60"
            >
              {loading ? "Einen Moment …" : "Link anfordern"}
            </button>
          </form>
          <p className="mt-6 text-sm">
            <Link href="/auth/signin" className="font-medium text-azure-800 underline underline-offset-2">
              Zurück zur Anmeldung
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
