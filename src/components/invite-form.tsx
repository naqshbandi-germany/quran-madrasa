"use client";

import { useActionState, type ReactNode } from "react";

import { CopyButton } from "@/components/copy-button";
import type { InviteState } from "@/lib/invite-actions";

// Formular zum Einladen: dieselben Felder, zwei Wege. "Per E-Mail einladen" verschickt die
// Einladung, "Link erstellen" zeigt nur den Link zum Kopieren bzw. Teilen per WhatsApp.
export function InviteForm({
  action,
  children,
  mailLabel = "Per E-Mail einladen",
  linkLabel = "Link erstellen",
  className = "",
}: {
  action: (prev: InviteState, formData: FormData) => Promise<InviteState>;
  children?: ReactNode;
  mailLabel?: string;
  linkLabel?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <div className={className}>
      <form action={formAction} className="space-y-3">
        {children}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="delivery"
            value="mail"
            disabled={pending}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
          >
            {mailLabel}
          </button>
          <button
            type="submit"
            name="delivery"
            value="link"
            disabled={pending}
            className="border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50 disabled:opacity-60"
          >
            {linkLabel}
          </button>
          {pending && <span className="self-center text-sm text-brand-600">Einen Moment …</span>}
        </div>
      </form>

      {state && (
        <div
          role={state.ok ? "status" : "alert"}
          className={`mt-3 space-y-2 border px-3 py-2 text-sm ${state.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-800"}`}
        >
          <p>{state.message}</p>
          {state.link && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  readOnly
                  value={state.link}
                  aria-label="Einladungslink"
                  onFocus={(e) => e.currentTarget.select()}
                  className="min-w-0 flex-1 border border-brand-300 bg-white px-2 py-1 font-mono text-xs text-brand-900"
                />
                <CopyButton text={state.link} label="Link kopieren" />
              </div>
              {state.shareText && (
                <div className="flex flex-wrap items-center gap-3">
                  <CopyButton text={state.shareText} label="Nachricht mit Link kopieren" />
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(state.shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-azure-800 underline"
                  >
                    Per WhatsApp teilen
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
