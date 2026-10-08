"use client";

import { forwardRef, useState } from "react";

import { PASSWORD_HINT, PASSWORD_RULES } from "@/lib/password-rules";
import { FloatingField } from "./floating-field";

type PasswordFieldProps = {
  id: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  // Live-Checkliste der Passwort-Anforderungen anzeigen (bei neuem Passwort)
  showRules?: boolean;
  error?: string | null;
  required?: boolean;
};

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  );
}

// Passwortfeld mit Anzeigen/Verbergen-Schalter und optionaler Live-Checkliste: erfuellte
// Anforderungen werden gruen markiert (mit Haekchen und Text fuer Screenreader, nicht nur
// per Farbe).
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { id, name = "password", label = "Passwort", value, onChange, autoComplete, showRules, error, required = true },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const results = PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(value) }));
  const fulfilled = results.filter((rule) => rule.ok).length;
  const rulesId = `${id}-rules`;

  return (
    <div>
      <FloatingField
        ref={ref}
        id={id}
        name={name}
        label={label}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        required={required}
        error={error}
        describedBy={showRules ? rulesId : undefined}
        endAdornment={
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
            aria-pressed={visible}
            className="flex h-11 w-11 items-center justify-center rounded-md text-brand-900/70 hover:text-azure-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-700"
          >
            <EyeIcon crossed={visible} />
          </button>
        }
      />

      {showRules && (
        <div id={rulesId} className="mt-3">
          <p className="text-sm font-medium text-brand-900/80">Dein Passwort braucht:</p>
          <ul className="mt-1 space-y-1.5 text-sm">
            {results.map((rule) => (
              <li
                key={rule.id}
                className={`flex items-center gap-2 transition-colors ${
                  rule.ok ? "text-green-800" : "text-brand-900/70"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                    rule.ok
                      ? "border-green-700 bg-green-700 text-white"
                      : "border-brand-900/35 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span>
                  {rule.label}
                  <span className="sr-only">{rule.ok ? " – erfüllt" : " – noch nicht erfüllt"}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-brand-900/65">{PASSWORD_HINT}</p>
          <p className="sr-only" role="status" aria-live="polite">
            {fulfilled} von {results.length} Anforderungen erfüllt
          </p>
        </div>
      )}
    </div>
  );
});
