"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";

type FloatingFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "placeholder" | "id"> & {
  id: string;
  label: string;
  // Hinweistext unter dem Feld (z. B. Format oder Zweck)
  hint?: ReactNode;
  // Fehlermeldung; setzt das Feld auf ungueltig und verknuepft die Meldung per aria-describedby
  error?: string | null;
  // Zusaetzliche IDs fuer aria-describedby (z. B. Passwort-Checkliste)
  describedBy?: string;
  // Element am rechten Rand des Feldes (z. B. Passwort anzeigen)
  endAdornment?: ReactNode;
};

// Eingabefeld, dessen Beschriftung beim Fokussieren oder Ausfuellen nach oben wandert
// ("Floating Label"). Die Beschriftung ist ein echtes <label> (Screenreader, Klick-Fokus),
// Fehler und Hinweise sind per aria-describedby mit dem Feld verbunden.
export const FloatingField = forwardRef<HTMLInputElement, FloatingFieldProps>(
  function FloatingField(
    { id, label, hint, error, describedBy, endAdornment, className = "", required, ...input },
    ref,
  ) {
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedByIds = [hintId, errorId, describedBy].filter(Boolean).join(" ") || undefined;

    return (
      <div className={className}>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            required={required}
            placeholder=" "
            aria-invalid={error ? true : undefined}
            aria-describedby={describedByIds}
            className={`peer block h-14 w-full rounded-md border bg-white px-3 pb-1.5 pt-5 text-base text-brand-900 outline-none transition focus:border-azure-700 focus:ring-2 focus:ring-azure-700/30 ${
              error ? "border-red-700" : "border-brand-300"
            } ${endAdornment ? "pr-12" : ""}`}
            {...input}
          />
          <label
            htmlFor={id}
            className="pointer-events-none absolute left-3 top-4 origin-left text-base text-brand-900/65 transition-all duration-150 peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-azure-700 peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:text-xs peer-autofill:top-1.5 peer-autofill:text-xs"
          >
            {label}
            {required ? <span aria-hidden="true"> *</span> : null}
          </label>
          {endAdornment && (
            <div className="absolute inset-y-0 right-1 flex items-center">{endAdornment}</div>
          )}
        </div>
        {hint && (
          <p id={hintId} className="mt-1 text-sm text-brand-900/70">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="mt-1 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    );
  },
);
