"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

import { FormAlert } from "@/components/form/form-alert";
import { PasswordField } from "@/components/form/password-field";
import { passwordMeetsRules } from "@/lib/password-rules";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!passwordMeetsRules(password)) {
      setPasswordError("Das Passwort erfüllt noch nicht alle Anforderungen.");
      document.getElementById("reset-password")?.focus();
      return;
    }
    setPasswordError(null);

    setLoading(true);
    try {
      const response = await fetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setFormError(
          <>
            {data.error ?? "Das hat nicht geklappt."}{" "}
            <Link href="/auth/passwort-vergessen" className="font-medium underline">
              Neuen Link anfordern
            </Link>
          </>,
        );
        return;
      }
      setDone(true);
    } catch {
      setFormError("Das hat nicht geklappt. Bitte versuche es in einem Moment noch einmal.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-4xl font-semibold text-brand-900">Link ungültig</h1>
        <p className="text-brand-900/80">
          Dieser Link ist unvollständig.{" "}
          <Link href="/auth/passwort-vergessen" className="font-medium text-azure-800 underline">
            Neuen Link anfordern
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-4xl font-semibold text-brand-900">Neues Passwort festlegen</h1>

      {done ? (
        <div role="status" className="mt-6 space-y-3 rounded-md border border-brand-200 bg-white p-5">
          <p className="font-medium text-brand-900">Dein Passwort wurde geändert.</p>
          <Link
            href="/auth/signin"
            className="inline-block rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
          >
            Jetzt anmelden
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <FormAlert>{formError}</FormAlert>
          <PasswordField
            id="reset-password"
            label="Neues Passwort"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            showRules
            error={passwordError}
          />
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-md bg-brand-600 px-4 font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700 disabled:opacity-60"
          >
            {loading ? "Einen Moment …" : "Passwort speichern"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
