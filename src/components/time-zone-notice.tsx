"use client";

import { useTransition } from "react";

import { timeZoneLabel } from "@/lib/time-zones";
import { setViewTimeZone } from "@/lib/view-time-zone-actions";

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
  const [pending, startTransition] = useTransition();
  const hasOwn = ownTimeZone !== "Europe/Berlin";

  if (!hasOwn) {
    return <p className="text-sm text-brand-600">Alle Zeiten in deutscher Zeit (MEZ/MESZ).</p>;
  }

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
          <button
            key={option.mode}
            type="button"
            aria-pressed={option.active}
            disabled={pending || option.active}
            onClick={() => startTransition(() => setViewTimeZone(option.mode))}
            className={`px-3 py-1.5 font-medium ${option.active ? "bg-azure-700 text-white" : "text-brand-800 hover:bg-brand-50"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
