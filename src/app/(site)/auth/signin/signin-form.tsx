"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { FloatingField } from "@/components/form/floating-field";
import { FormAlert } from "@/components/form/form-alert";
import { GoogleButton, OrDivider } from "@/components/form/google-button";
import { PasswordField } from "@/components/form/password-field";
import { safeCallbackUrl } from "@/lib/safe-redirect";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SignInForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const enrolling = callbackUrl.startsWith("/courses/");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const emailProblem = EMAIL_PATTERN.test(email.trim())
      ? null
      : "Bitte gib deine E-Mail-Adresse ein, z. B. name@beispiel.de.";
    const passwordProblem = password ? null : "Bitte gib dein Passwort ein.";
    setEmailError(emailProblem);
    setPasswordError(passwordProblem);
    if (emailProblem || passwordProblem) {
      document.getElementById(emailProblem ? "signin-email" : "signin-password")?.focus();
      return;
    }

    setLoading(true);
    const result = await signIn("credentials", {
      email: email.trim(),
      password,
      redirect: false,
    });
    setLoading(false);

    if (result?.error) {
      setFormError("E-Mail oder Passwort stimmt nicht. Bitte prüfe deine Eingaben.");
      return;
    }

    // Voller Seiten-Reload statt router.push: sonst kann der Next.js
    // Router-Cache eine vor dem Login geladene (nicht-eingeloggte)
    // Version von z.B. /dashboard weiter anzeigen.
    window.location.href = callbackUrl;
  }

  const signupHref = `/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-4xl font-semibold text-brand-900">Anmelden</h1>
      <p className="mt-2 text-brand-900/75">
        {enrolling
          ? "Melde dich an, um dich für den Kurs anzumelden. Danach geht es direkt dort weiter."
          : "Schön, dass du da bist. Melde dich mit deinem Konto an."}
      </p>

      <div className="mt-6 space-y-4">
        <FormAlert>{formError}</FormAlert>

        {googleEnabled && (
          <>
            <GoogleButton callbackUrl={callbackUrl} label="Mit Google anmelden" />
            <OrDivider />
          </>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <FloatingField
            id="signin-email"
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
          <PasswordField
            id="signin-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            error={passwordError}
          />
          <div className="text-right">
            <Link
              href="/auth/passwort-vergessen"
              className="text-sm font-medium text-azure-800 underline underline-offset-2 hover:text-azure-700"
            >
              Passwort vergessen?
            </Link>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-md bg-brand-600 px-4 font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700 disabled:opacity-60"
          >
            {loading ? "Einen Moment …" : "Anmelden"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-sm text-brand-900/80">
        Noch kein Konto?{" "}
        <Link href={signupHref} className="font-medium text-azure-800 underline underline-offset-2">
          Konto erstellen
        </Link>
      </p>
    </div>
  );
}
