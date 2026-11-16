"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Crumb = { label: string; href?: string };

// Feste Bezeichnungen der Pfade; Ordner ohne eigene Seite (courses, sitzungen) fehlen.
const STATIC_LABELS: Record<string, string> = {
  "/admin": "Admin-Bereich",
  "/admin/emails": "E-Mail-Texte",
  "/admin/konten": "Konten",
  "/admin/benachrichtigungen": "Benachrichtigungen",
  "/admin/benachrichtigungen/einstellungen": "E-Mail-Einstellungen",
  "/teacher/benachrichtigungen": "Benachrichtigungen",
  "/teacher/benachrichtigungen/einstellungen": "E-Mail-Einstellungen",
  "/teacher": "Übersicht",
  "/teacher/kurse": "Kurse",
  "/teacher/schueler": "Schüler",
  "/teacher/schueler/einladen": "Schüler einladen",
  "/teacher/termine": "Termine",
  "/teacher/profil": "Mein Profil",
  "/teacher/mediathek": "Mediathek",
  "/teacher/emails": "E-Mails",
};

// Baut die Pfadleiste aus der URL. Namen aus der Datenbank (Kurstitel, Konten, E-Mail-Texte)
// reicht das Layout als `names` (Pfad -> Name) herein.
function buildCrumbs(pathname: string, names: Record<string, string>): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [];
  let path = "";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    path += `/${part}`;
    const prev = parts[i - 1];

    if (path === "/teacher/courses") {
      // Einzelne Kurse haengen unter "Kurse" (fuer Lehrkraefte und Admins).
      crumbs.splice(0, crumbs.length, { label: "Kurse", href: "/teacher/kurse" });
      continue;
    }
    if (part === "sitzungen") continue;
    // Kurse, Schueler, Mediathek usw. stehen im Menue neben der Uebersicht, nicht darunter.
    if (path === "/teacher" && i < parts.length - 1) continue;

    let label = STATIC_LABELS[path] ?? names[path];
    if (!label && prev === "sitzungen") label = "Stunde auswerten";
    if (!label && part === "leseproben") label = "Leseproben";
    if (!label && prev === "konten") label = "Konto löschen";
    if (!label && prev === "courses") label = "Kurs";
    if (!label) label = decodeURIComponent(part);
    crumbs.push({ label, href: path });
  }
  if (crumbs.length > 0) delete crumbs[crumbs.length - 1].href;
  return crumbs;
}

export function AppBreadcrumbs({ names }: { names: Record<string, string> }) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname, names);

  return (
    <nav aria-label="Pfad" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
        {crumbs.map((crumb, i) => (
          <li key={i} className="flex min-w-0 items-center gap-2">
            {i > 0 && (
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
            {crumb.href ? (
              <Link href={crumb.href} className="truncate text-slate-600 hover:text-[#14325c] hover:underline">
                {crumb.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate font-semibold text-slate-900">
                {crumb.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
