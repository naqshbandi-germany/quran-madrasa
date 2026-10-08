"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { CheckboxField } from "@/components/form/checkbox-field";
import { FloatingField } from "@/components/form/floating-field";
import { FormAlert } from "@/components/form/form-alert";
import { GoogleButton, OrDivider } from "@/components/form/google-button";
import { PasswordField } from "@/components/form/password-field";
import { passwordMeetsRules } from "@/lib/password-rules";
import { safeCallbackUrl } from "@/lib/safe-redirect";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Errors = Partial<Record<"name" | "email" | "password" | "adult" | "privacy", string>>;

export function SignUpForm({ googleEnabled }: { googleEnabled: boolean }) {
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));
  const enrolling = callbackUrl.startsWith("/courses/");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adult, setAdult] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(false);

  function clearError(key: keyof Errors) {
    setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const next: Errors = {};
    if (name.trim().length < 2) next.name = "Bitte gib deinen Namen ein.";
    if (!EMAIL_PATTERN.test(email.trim()))
      next.email = "Bitte gib eine gültige E-Mail-Adresse ein, z. B. name@beispiel.de.";
    if (!passwordMeetsRules(password)) next.password = "Das Passwort erfüllt noch nicht alle Anforderungen.";
    if (!adult) next.adult = "Bitte bestätige, dass du mindestens 18 Jahre alt bist.";
    if (!privacy) next.privacy = "Bitte bestätige, dass du die Datenschutzerklärung gelesen hast.";
    setErrors(next);

    const firstInvalid = (["name", "email", "password", "adult", "privacy"] as const).find(
      (key) => next[key],
    );
    if (firstInvalid) {
      document.getElementById(`signup-${firstInvalid}`)?.focus();
      return;
    }

    setLoading(true);
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        password,
        adultConfirmed: true,
        privacyAcknowledged: true,
      }),
    });

    if (!response.ok) {
      setLoading(false);
      if (response.status === 409) {
        setErrors({ email: "Zu dieser E-Mail-Adresse gibt es schon ein Konto." });
        setFormError(
          <>
            Zu dieser E-Mail-Adresse gibt es schon ein Konto.{" "}
            <Link
              href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="font-medium underline"
            >
              Jetzt anmelden
            </Link>{" "}
            oder{" "}
            <Link href="/auth/passwort-vergessen" className="font-medium underline">
              Passwort zurücksetzen
            </Link>
            .
          </>,
        );
      } else {
        setFormError("Die Registrierung hat nicht geklappt. Bitte prüfe deine Eingaben und versuche es erneut.");
      }
      return;
    }

    await signIn("credentials", { email: email.trim(), password, redirect: false });
    // Voller Seiten-Reload statt router.push, siehe Kommentar im Anmeldeformular.
    window.location.href = callbackUrl;
  }

  const signinHref = `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`;

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-4xl font-semibold text-brand-900">Konto erstellen</h1>
      <p className="mt-2 text-brand-900/75">
        {enrolling
          ? "Erstelle ein Konto, um dich für den Kurs anzumelden. Danach geht es direkt dort weiter."
          : "Mit einem Konto meldest du dich für Kurse an, siehst deine Termine und bekommst die Zugangslinks."}{" "}
        Du kannst später dich selbst, deine Kinder oder andere Personen anmelden.
      </p>

      <div className="mt-6 space-y-4">
        <FormAlert>{formError}</FormAlert>

        {googleEnabled && (
          <>
            <GoogleButton callbackUrl={callbackUrl} label="Mit Google fortfahren" />
            <p className="text-xs text-brand-900/70">
              Mit Google fortfahren bedeutet: Du bist mindestens 18 Jahre alt und hast die{" "}
              <Link href="/datenschutz" target="_blank" className="underline">
                Datenschutzerklärung
              </Link>{" "}
              gelesen.
            </p>
            <OrDivider />
          </>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <p className="text-sm text-brand-900/70">Felder mit * sind Pflichtfelder.</p>

          <FloatingField
            id="signup-name"
            name="name"
            label="Vor- und Nachname"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearError("name");
            }}
            error={errors.name}
          />
          <FloatingField
            id="signup-email"
            name="email"
            type="email"
            label="E-Mail-Adresse"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearError("email");
            }}
            hint="Hierhin schicken wir Kursinformationen und die Zugangslinks."
            error={errors.email}
          />
          <PasswordField
            id="signup-password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              clearError("password");
            }}
            autoComplete="new-password"
            showRules
            error={errors.password}
          />

          <div className="space-y-3 pt-1">
            <CheckboxField
              id="signup-adult"
              checked={adult}
              onChange={(event) => {
                setAdult(event.target.checked);
                clearError("adult");
              }}
              error={errors.adult}
            >
              Ich bin mindestens 18 Jahre alt. Kinder und Jugendliche melde ich später als
              Teilnehmer an.
            </CheckboxField>
            <CheckboxField
              id="signup-privacy"
              checked={privacy}
              onChange={(event) => {
                setPrivacy(event.target.checked);
                clearError("privacy");
              }}
              error={errors.privacy}
            >
              Ich habe die{" "}
              <Link href="/datenschutz" target="_blank" className="font-medium underline">
                Datenschutzerklärung
              </Link>{" "}
              gelesen.
            </CheckboxField>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-md bg-brand-600 px-4 font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700 disabled:opacity-60"
          >
            {loading ? "Einen Moment …" : "Konto erstellen"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-sm text-brand-900/80">
        Du hast schon ein Konto?{" "}
        <Link href={signinHref} className="font-medium text-azure-800 underline underline-offset-2">
          Anmelden
        </Link>
      </p>
    </div>
  );
}
