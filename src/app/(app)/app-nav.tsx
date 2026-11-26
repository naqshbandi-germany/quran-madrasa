"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { GridIcon, LibraryIcon, MailIcon, XIcon } from "@/components/icons";
import { AppSignOutButton } from "./app-sign-out-button";

export type NavIcon = "grid" | "book" | "users" | "template" | "library" | "mail" | "bell" | "student" | "calendar";
// badge: Zahl neben dem Eintrag, z. B. ungelesene Benachrichtigungen (0 = keine Anzeige).
export type NavLink = { href: string; label: string; icon: NavIcon; badge?: number };
// Oberpunkt ohne eigene Seite, klappt seine Unterpunkte auf.
export type NavParent = { label: string; icon: NavIcon; children: { href: string; label: string }[] };
export type NavGroup = { title: string; links: (NavLink | NavParent)[] };

function isParent(link: NavLink | NavParent): link is NavParent {
  return "children" in link;
}

function Svg({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const ICONS: Record<NavIcon, React.ReactNode> = {
  grid: <GridIcon className="h-5 w-5" />,
  library: <LibraryIcon className="h-5 w-5" />,
  mail: <MailIcon className="h-5 w-5" />,
  book: (
    <Svg>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5Z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </Svg>
  ),
  users: (
    <Svg>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" />
    </Svg>
  ),
  bell: (
    <Svg>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Svg>
  ),
  calendar: (
    <Svg>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 11h18" />
    </Svg>
  ),
  student: (
    <Svg>
      <path d="M22 10 12 5 2 10l10 5 10-5Z" />
      <path d="M6 12v5c3 2 9 2 12 0v-5" />
    </Svg>
  ),
  template: (
    <Svg>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9h10M7 13h6" />
    </Svg>
  ),
};

function MenuIcon() {
  return (
    <Svg>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  );
}

// Aktiv ist der Eintrag mit dem laengsten passenden Pfad (/admin/konten vor /admin).
function activeHref(rawPathname: string, groups: NavGroup[]) {
  // Einzelne Kurse (/teacher/courses/...) gehoeren zum Menuepunkt "Kurse".
  const pathname = rawPathname.startsWith("/teacher/courses/") ? "/teacher/kurse" : rawPathname;
  const matches = groups
    .flatMap((g) => g.links.flatMap((l) => (isParent(l) ? l.children.map((c) => c.href) : [l.href])))
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  return matches.sort((a, b) => b.length - a.length)[0];
}

// Seitenleiste der Verwaltung: ab lg fest am linken Rand (scrollt nicht mit), darunter
// eine schmale Kopfleiste mit Menue-Knopf, die die Leiste als Schublade einblendet.
export function AppNav({
  siteName,
  areaLabel,
  groups,
  userName,
  userRole,
}: {
  siteName: string;
  areaLabel: string;
  groups: NavGroup[];
  userName: string;
  userRole: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = activeHref(pathname, groups);

  // Von Hand auf- oder zugeklappte Oberpunkte; sonst offen, wenn man in einem Unterpunkt ist.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  // Nach einem Seitenwechsel die Schublade wieder schliessen
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
    setToggled({});
  }

  const firstLink = groups[0]?.links[0];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const brand = (
    <Link href={firstLink && !isParent(firstLink) ? firstLink.href : "/"} className="block">
      <span className="block text-lg font-bold leading-tight text-white">{siteName}</span>
      <span className="mt-0.5 block text-sm font-medium uppercase tracking-wider text-slate-400">
        {areaLabel}
      </span>
    </Link>
  );

  const panel = (
    <div className="flex h-full flex-col">
      <div className="hidden px-6 py-6 lg:block">{brand}</div>

      <nav aria-label="Verwaltung" className="flex-1 overflow-y-auto px-3 py-4 [color-scheme:dark] lg:py-2">
        {groups.map((group) => (
          <div key={group.title} className="mb-6">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {group.title}
            </p>
            <ul className="space-y-1">
              {group.links.map((link) => {
                if (isParent(link)) {
                  const hasActive = link.children.some((c) => c.href === current);
                  const expanded = toggled[link.label] ?? hasActive;
                  return (
                    <li key={link.label}>
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setToggled((state) => ({ ...state, [link.label]: !expanded }))}
                        className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-base font-medium transition-colors hover:bg-white/5 hover:text-white ${
                          hasActive ? "text-white" : "text-slate-300"
                        }`}
                      >
                        {ICONS[link.icon]}
                        {link.label}
                        <svg
                          viewBox="0 0 24 24"
                          className={`ml-auto h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </button>
                      {expanded && (
                        <ul className="mt-1 space-y-0.5 rounded-md bg-white/[0.06] p-1.5">
                          {link.children.map((child) => {
                            const childActive = child.href === current;
                            return (
                              <li key={child.href}>
                                <Link
                                  href={child.href}
                                  aria-current={childActive ? "page" : undefined}
                                  className={`block rounded py-2 pl-9 pr-3 text-base transition-colors ${
                                    childActive
                                      ? "bg-white/10 font-medium text-white shadow-[inset_3px_0_0_0_#7fb0e6]"
                                      : "text-slate-200 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  {child.label}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }
                const active = link.href === current;
                return (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-base font-medium transition-colors ${
                        active
                          ? "bg-white/10 text-white shadow-[inset_3px_0_0_0_#7fb0e6]"
                          : "text-slate-300 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {ICONS[link.icon]}
                      {link.label}
                      {!!link.badge && (
                        <span className="ml-auto rounded-full bg-[#7fb0e6] px-2 py-0.5 text-xs font-semibold text-[#0d2240]">
                          {link.badge}
                          <span className="sr-only"> ungelesen</span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-6 py-5 text-base">
        <p className="font-medium text-white">{userName}</p>
        <p className="text-sm text-slate-400">{userRole}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-300 [&_button]:text-slate-300 [&_button:hover]:text-white">
          <Link href="/" className="underline underline-offset-2 hover:text-white">
            Zur Website
          </Link>
          <AppSignOutButton />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Kopfleiste auf schmalen Bildschirmen */}
      <div className="sticky top-0 z-40 flex items-center justify-between gap-4 bg-[#0d2240] px-4 py-3 lg:hidden">
        {brand}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="app-nav-drawer"
          className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3 py-2 text-base font-medium text-white hover:bg-white/10"
        >
          <MenuIcon />
          Menü
        </button>
      </div>

      {/* Schublade (Handy/Tablet) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menü">
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-slate-900/50"
          />
          <div
            id="app-nav-drawer"
            className="absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col bg-[#0d2240] shadow-xl"
          >
            <div className="flex items-center justify-between gap-4 px-6 py-5">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Menü schließen"
                className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1">{panel}</div>
          </div>
        </div>
      )}

      {/* Feste Seitenleiste ab lg */}
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 bg-[#0d2240] lg:block">{panel}</aside>
    </>
  );
}
