"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { VIEW_AS_EXIT_PATH, VIEW_AS_INFO_COOKIE, type ViewAsInfo } from "@/lib/view-as";

const ROLE_LABEL = { STUDENT: "Schüler", TEACHER: "Lehrer" } as const;

function readCookie() {
  const entry = document.cookie.split("; ").find((c) => c.startsWith(`${VIEW_AS_INFO_COOKIE}=`));
  return entry ? entry.slice(VIEW_AS_INFO_COOKIE.length + 1) : "";
}

// Cookies loesen kein Ereignis aus. Neu gelesen wird bei jedem Seitenwechsel (usePathname), denn
// das Starten leitet ohne Neuladen weiter; das Beenden laedt die Seite komplett neu.
const subscribe = () => () => {};

// Person, als die ein Admin die Website im Entwicklermodus gerade ansieht (sonst null).
export function useViewAs(): ViewAsInfo | null {
  usePathname();
  const raw = useSyncExternalStore(subscribe, readCookie, () => "");
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as ViewAsInfo;
  } catch {
    return null;
  }
}

// Gut sichtbare Leiste ueber jeder Seite, solange der Entwicklermodus aktiv ist.
export function ViewAsBanner() {
  const viewAs = useViewAs();
  if (!viewAs) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-amber-300 px-4 py-2 text-center text-sm text-amber-950"
    >
      <span>
        <strong>Entwicklermodus:</strong> Du siehst die Website als {viewAs.name} ({ROLE_LABEL[viewAs.role]}).
        Änderungen sind gesperrt.
      </span>
      {/* Absichtlich <a> statt <Link>: echter Seitenaufruf, damit alle Bereiche neu geladen werden. */}
      <a href={VIEW_AS_EXIT_PATH} className="font-semibold underline">
        Zurück zur Admin-Ansicht
      </a>
    </div>
  );
}
