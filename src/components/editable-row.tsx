"use client";

import { useState, type ReactNode } from "react";

import { PencilIcon } from "@/components/icons";

// Zeile in einer Verwaltungsliste: links der Inhalt, direkt daneben "Bearbeiten" (Stift) und die
// Entfernen-Aktion (Papierkorb, als fertiges Formular uebergeben). "Bearbeiten" klappt unter der
// Zeile ein Formular auf (children).
export function EditableRow({
  summary,
  removeAction,
  children,
}: {
  summary: ReactNode;
  removeAction: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-md border border-brand-200 bg-white px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="min-w-0">{summary}</div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex items-center gap-1.5 rounded-md font-medium text-azure-800 hover:text-azure-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700"
          >
            <PencilIcon />
            {open ? "Schließen" : "Bearbeiten"}
          </button>
          {removeAction}
        </div>
      </div>
      {open && <div className="mt-3 border-t border-brand-100 pt-3">{children}</div>}
    </li>
  );
}
