"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { AuthNav } from "./auth-nav";

const NAV_LINKS = [
  { href: "/", label: "Kursangebot" },
  { href: "/stundenplan", label: "Stundenplan" },
  { href: "/lehrer", label: "Lehrer" },
  { href: "/ueber-uns", label: "Ziel & Zweck" },
  { href: "/dashboard", label: "Mein Bereich" },
];

const LINK_STYLE = "text-white/90 transition hover:text-gold-200";

export function SiteNav() {
  // Das Menue ist nur fuer die Seite offen, auf der es geoeffnet wurde - bei jedem
  // Seitenwechsel ist es dadurch automatisch wieder geschlossen.
  const pathname = usePathname();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const open = openOnPath === pathname;

  return (
    <nav className="mx-auto max-w-5xl px-4">
      <div className="flex items-center justify-between py-3">
        <Link href="/" className="font-serif text-xl font-semibold tracking-wide text-gold-200">
          Quran Madrasa
        </Link>

        <div className="hidden items-center gap-5 text-sm md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={LINK_STYLE}>
              {link.label}
            </Link>
          ))}
          <AuthNav className={LINK_STYLE} />
        </div>

        <button
          type="button"
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpenOnPath(open ? null : pathname)}
          className="rounded-md border border-white/30 p-2 text-white md:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="flex flex-col gap-1 border-t border-white/15 pb-4 pt-2 text-base md:hidden"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-2 py-2.5 hover:bg-white/10 ${LINK_STYLE}`}
            >
              {link.label}
            </Link>
          ))}
          <AuthNav className={`px-2 py-2.5 ${LINK_STYLE}`} />
        </div>
      )}
    </nav>
  );
}
