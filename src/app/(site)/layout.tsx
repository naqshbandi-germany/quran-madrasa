import { cookies } from "next/headers";
import Link from "next/link";

import { PreviewHeader } from "@/components/preview-header";
import { PREVIEW_COOKIE, previewCode } from "@/lib/preview";
import { SiteNav } from "./site-nav";

// Besucher ohne Vorschau-Freigabe sehen keine Hauptnavigation, deren Ziele noch nicht oeffentlich
// sind. Cookies nur im Vorschau-Modus lesen: Sonst wuerden alle Seiten dynamisch.
async function isGatedVisitor() {
  const code = previewCode();
  return code !== null && (await cookies()).get(PREVIEW_COOKIE)?.value !== code;
}

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const gated = await isGatedVisitor();
  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gold-400/40 bg-white/95 backdrop-blur">
        {gated ? <PreviewHeader maxWidth="max-w-5xl" /> : <SiteNav />}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <footer className="border-t border-brand-200 py-6 text-center text-sm text-brand-700">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
          <Link href="/kontakt" className="underline underline-offset-2 hover:text-brand-600">
            Kontakt
          </Link>
          <Link href="/agb" className="underline underline-offset-2 hover:text-brand-600">
            AGB
          </Link>
          <Link href="/widerruf" className="underline underline-offset-2 hover:text-brand-600">
            Widerruf
          </Link>
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
