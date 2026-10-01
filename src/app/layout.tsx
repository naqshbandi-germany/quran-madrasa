import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";
import { AuthNav } from "./auth-nav";
import { AuthProvider } from "./providers";

export const metadata: Metadata = {
  title: "Quran Madrasa",
  description: "Online-Unterricht für Koran-Rezitation und islamische Wissenschaften",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <AuthProvider>
          <header className="sticky top-0 z-50 border-b border-brand-200 bg-white/90 shadow-sm backdrop-blur">
            <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-lg font-semibold text-brand-700">
                Quran Madrasa
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <Link href="/">Kursangebot</Link>
                <Link href="/stundenplan">Stundenplan</Link>
                <Link href="/lehrer">Lehrer</Link>
                <Link href="/ueber-uns">Ziel &amp; Zweck</Link>
                <Link href="/dashboard">Mein Bereich</Link>
                <AuthNav />
              </div>
            </nav>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
