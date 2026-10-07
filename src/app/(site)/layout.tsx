import Link from "next/link";

import { SiteNav } from "./site-nav";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-50 border-b-4 border-gold-400 bg-azure-800 shadow-md">
        <SiteNav />
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t border-brand-200 py-6 text-center text-sm text-brand-700">
        <Link href="/bildnachweis" className="underline underline-offset-2 hover:text-brand-600">
          Bildnachweis
        </Link>
      </footer>
    </>
  );
}
