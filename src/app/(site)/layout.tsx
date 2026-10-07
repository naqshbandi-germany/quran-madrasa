import Link from "next/link";

import { SiteNav } from "./site-nav";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-brand-200 bg-white/95 backdrop-blur">
        <SiteNav />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t border-brand-200 py-6 text-center text-sm text-brand-700">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/impressum" className="underline underline-offset-2 hover:text-brand-600">
            Impressum
          </Link>
          <Link href="/datenschutz" className="underline underline-offset-2 hover:text-brand-600">
            Datenschutz
          </Link>
          <Link href="/bildnachweis" className="underline underline-offset-2 hover:text-brand-600">
            Bildnachweis
          </Link>
        </nav>
      </footer>
    </>
  );
}
