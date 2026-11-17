"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Reiter der Kursverwaltung. "Teilnehmer" ist die Startseite des Kurses; Stunden-Auswertung und
// Leseproben gehoeren zum Reiter "Sitzungen".
export function CourseTabs({ courseId, counts }: { courseId: string; counts: { participants: number; unheard: number } }) {
  const pathname = usePathname();
  const base = `/teacher/courses/${courseId}`;
  const rest = pathname.startsWith(base) ? pathname.slice(base.length) : "";

  const tabs = [
    { label: `Teilnehmer (${counts.participants})`, href: base, active: rest === "" },
    {
      label: "Sitzungen",
      // Neue, noch nicht gehoerte Leseproben
      badge: counts.unheard > 0 ? `${counts.unheard} neu` : undefined,
      href: `${base}/sitzungen`,
      active: rest.startsWith("/sitzungen") || rest.startsWith("/leseproben"),
    },
    { label: "Nachrichten", href: `${base}/nachrichten`, active: rest.startsWith("/nachrichten") },
    { label: "Einstellungen", href: `${base}/einstellungen`, active: rest.startsWith("/einstellungen") },
  ];

  return (
    <nav aria-label="Kursverwaltung" className="overflow-x-auto overflow-y-hidden border-b border-gold-400/50">
      <ul className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <li key={tab.href}>
            <Link
              href={tab.href}
              aria-current={tab.active ? "page" : undefined}
              className={`-mb-px block border px-3 py-2.5 text-sm font-semibold sm:px-4 transition ${
                tab.active
                  ? "border-gold-400/50 border-b-white bg-white text-azure-800"
                  : "border-transparent text-brand-700 hover:bg-brand-50 hover:text-azure-800"
              }`}
            >
              {tab.label}
              {"badge" in tab && tab.badge && (
                <span
                  title="neue Leseproben"
                  className="ml-1.5 bg-azure-800 px-1.5 py-0.5 text-xs font-semibold text-white"
                >
                  {tab.badge}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
