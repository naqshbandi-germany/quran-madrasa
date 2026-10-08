"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { UserMenu } from "./user-menu";

const COURSE_LINKS = [
  { href: "/quran", label: "Quran-Rezitation" },
  { href: "/courses/imam-al-ghazali-kurs", label: "Imam al-Ghazali" },
  { href: "/courses/shamail-und-seerah", label: "Shamail & Seerah" },
  { href: "/courses/einstieg-fiqh-aqidah", label: "Fiqh & Aqidah" },
  { href: "/courses/islamische-seelenlehre-charakterbildung", label: "Seelenlehre & Charakter" },
];

const OTHER_LINKS = [
  { href: "/stundenplan", label: "Stundenplan" },
  { href: "/lehrer", label: "Lehrer" },
  { href: "/ueber-uns", label: "Ziel & Zweck" },
];

const LINK_STYLE = "text-brand-900 transition hover:text-azure-700";

export function SiteNav() {
  // Das Menue ist nur fuer die Seite offen, auf der es geoeffnet wurde - bei jedem
  // Seitenwechsel ist es dadurch automatisch wieder geschlossen.
  const pathname = usePathname();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const open = openOnPath === pathname;

  return (
    <nav className="mx-auto max-w-5xl px-4">
      <div className="flex items-center justify-between py-3">
        <Link
          href="/"
          className="font-display text-2xl font-semibold uppercase tracking-[0.16em] text-azure-800"
        >
          Quran Madrasa
        </Link>

        <div className="hidden items-center gap-5 text-sm lg:flex">
          {/* Kursangebot mit Untermenue (Hover und Tastatur-Fokus) */}
          <div className="group relative">
            <Link href="/" className={`inline-flex items-center gap-1 ${LINK_STYLE}`}>
              Kursangebot
              <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M2.5 4.5 6 8l3.5-3.5" />
              </svg>
            </Link>
            <div className="invisible absolute left-0 top-full z-50 pt-3 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <ul className="min-w-56 rounded-md border border-brand-200 bg-white py-2 shadow-lg">
                {COURSE_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block px-4 py-2 text-brand-900 transition hover:bg-brand-100 hover:text-azure-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {OTHER_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={LINK_STYLE}>
              {link.label}
            </Link>
          ))}
          {/* Konto-Bereich getrennt vom Hauptmenue */}
          <div className="ml-1 border-l border-brand-200 pl-5">
            <UserMenu />
          </div>
        </div>

        <button
          type="button"
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpenOnPath(open ? null : pathname)}
          className="rounded-md border border-brand-200 p-2 text-azure-800 lg:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div
          id="mobile-menu"
          className="flex flex-col gap-1 border-t border-brand-200 pb-4 pt-2 text-base lg:hidden"
        >
          <Link
            href="/"
            className={`rounded-md px-2 py-2.5 hover:bg-brand-100 ${LINK_STYLE}`}
          >
            Kursangebot
          </Link>
          {COURSE_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md py-2 pl-7 pr-2 text-sm hover:bg-brand-100 ${LINK_STYLE}`}
            >
              {link.label}
            </Link>
          ))}
          {OTHER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-2 py-2.5 hover:bg-brand-100 ${LINK_STYLE}`}
            >
              {link.label}
            </Link>
          ))}
          <UserMenu inline />
        </div>
      )}
    </nav>
  );
}
