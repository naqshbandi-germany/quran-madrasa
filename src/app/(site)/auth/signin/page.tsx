"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";

function SignInForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("E-Mail oder Passwort ist falsch.");
      return;
    }

    // Voller Seiten-Reload statt router.push: sonst kann der Next.js
    // Router-Cache eine vor dem Login geladene (nicht-eingeloggte)
    // Version von z.B. /dashboard weiter anzeigen.
    window.location.href = searchParams.get("callbackUrl") ?? "/dashboard";
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold text-brand-700">Anmelden</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">E-Mail</label>
          <input
            name="email"
            type="email"
            required
            className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Passwort</label>
          <input
            name="password"
            type="password"
            required
            className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Einen Moment..." : "Anmelden"}
        </button>
      </form>
      <p className="mt-4 text-sm text-brand-600">
        Noch kein Konto?{" "}
        <Link href="/auth/signup" className="font-medium text-brand-700 underline">
          Jetzt registrieren
        </Link>
      </p>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
