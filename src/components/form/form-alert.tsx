"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Fehlerhinweis ueber dem Formular: wird von Screenreadern sofort vorgelesen (role="alert")
// und erhaelt den Fokus, damit Tastaturnutzer die Meldung nicht uebersehen.
export function FormAlert({ children }: { children: ReactNode | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (children) ref.current?.focus();
  }, [children]);

  if (!children) return null;

  return (
    <div
      ref={ref}
      role="alert"
      tabIndex={-1}
      className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900 outline-none focus:ring-2 focus:ring-red-600"
    >
      {children}
    </div>
  );
}
