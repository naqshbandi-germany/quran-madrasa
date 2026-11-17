"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { timeZoneLabel } from "@/lib/time-zones";

// Hinweis ueber Zeitangaben im Lehrer-Bereich. Wer eine eigene Zeitzone hat, kann zwischen
// Ortszeit und deutscher Zeit (MEZ/MESZ) umschalten; Eingaben gelten in der angezeigten Zone.
export function TimeZoneNotice({
  timeZone,
  ownTimeZone,
  showingOwn,
}: {
  timeZone: string;
  ownTimeZone: string;
  showingOwn: boolean;
}) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const back = encodeURIComponent(query ? `${pathname}?${query}` : pathname);
  const hasOwn = ownTimeZone !== "Europe/Berlin";

  // Nur fuer Lehrkraefte mit eigener Zeitzone; sonst ist ohnehin alles deutsche Zeit.
  if (!hasOwn) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border border-azure-200 bg-azure-50 px-4 py-3 text-sm text-brand-900">
      <p>
        {showingOwn ? (
          <>
            Alle Zeiten werden in <strong>deiner Zeitzone</strong> angezeigt und eingegeben: {timeZoneLabel(timeZone)}.
          </>
        ) : (
          <>
            Alle Zeiten werden in <strong>deutscher Zeit (MEZ/MESZ)</strong> angezeigt und eingegeben.
          </>
        )}
      </p>
      <div role="group" aria-label="Zeitzone der Anzeige" className="inline-flex overflow-hidden rounded-md border border-brand-300 bg-white">
        {[
          { mode: "lokal" as const, label: "Meine Ortszeit", active: showingOwn },
          { mode: "mez" as const, label: "MEZ", active: !showingOwn },
        ].map((option) => (
          // Normaler Link (GET), damit der Umschalter auch im Entwicklermodus "Ansehen als" geht.
          <a
            key={option.mode}
            href={`/api/zeitanzeige?modus=${option.mode}&zurueck=${back}`}
            aria-current={option.active ? "true" : undefined}
            className={`px-3 py-1.5 font-medium ${option.active ? "pointer-events-none bg-azure-700 text-white" : "text-brand-800 hover:bg-brand-50"}`}
          >
            {option.label}
          </a>
        ))}
      </div>
    </div>
  );
}
