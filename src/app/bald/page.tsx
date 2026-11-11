import type { Metadata } from "next";
import Link from "next/link";

// Platzhalter-Seite, solange die Website im Vorschau-Modus ist (siehe src/proxy.ts).
export const metadata: Metadata = {
  title: "Quran Madrasa – bald verfügbar",
  robots: { index: false, follow: false },
};

export default function ComingSoonPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-xs uppercase tracking-[0.18em] text-azure-700">Quran Madrasa</p>
      <h1 className="mt-2 font-display text-4xl font-semibold text-azure-800">Bald verfügbar</h1>
      <p className="mt-4 text-brand-900/80">
        Unser Online-Angebot für Quran-Unterricht und islamische Wissenschaften befindet sich im
        Aufbau. Schau bald wieder vorbei.
      </p>
      <p className="mt-8 text-sm text-brand-600">
        Du nimmst an der Testphase teil?{" "}
        <Link href="/auth/signin" className="font-medium text-azure-800 underline">
          Hier anmelden
        </Link>
      </p>
      <nav className="mt-10 flex gap-6 text-sm text-brand-700">
        <Link href="/impressum" className="underline underline-offset-2">
          Impressum
        </Link>
        <Link href="/datenschutz" className="underline underline-offset-2">
          Datenschutz
        </Link>
      </nav>
    </main>
  );
}
