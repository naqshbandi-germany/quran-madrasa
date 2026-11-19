"use client";

import { useActionState, useRef } from "react";

import { EmailPreview } from "@/components/email-preview";
import type { EditableEmail } from "@/lib/email-templates";
import { cancelTrial, type CancelTrialState } from "@/lib/trial-actions";

// Probestunde absagen: Fenster mit der Absage-Mail (Vorschau, Text anpassbar) und Bestaetigung.
export function TrialCancelButton({
  trialId,
  editable,
  values,
  guestCount,
}: {
  trialId: string;
  editable: EditableEmail;
  // Angaben fuer die Vorschau: name (erster Gast), kurs, datum
  values: Record<string, string>;
  // Gaeste mit E-Mail-Adresse (bekommen die Absage)
  guestCount: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<CancelTrialState, FormData>(cancelTrial, null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="font-medium text-red-700 underline"
      >
        Absagen
      </button>
      <dialog
        ref={dialogRef}
        className="w-[min(40rem,calc(100vw-2rem))] whitespace-normal border border-gold-400/60 bg-white p-0 text-left backdrop:bg-black/40"
      >
        <form action={action} className="space-y-4 p-5">
          <input type="hidden" name="trialId" value={trialId} />
          <h2 className="text-lg font-semibold text-azure-800">Probestunde absagen</h2>
          <p className="text-sm text-brand-700">
            {guestCount === 0
              ? "Niemand bekommt eine E-Mail (keine Gäste mit E-Mail-Adresse). Per WhatsApp Eingeladene informierst du selbst."
              : `${guestCount} ${guestCount === 1 ? "Gast bekommt" : "Gäste bekommen"} diese Absage per E-Mail. Per WhatsApp Eingeladene ohne E-Mail-Adresse informierst du selbst.`}
          </p>
          {guestCount > 0 && <EmailPreview templateKey="trial_cancelled" editable={editable} values={values} defaultOpen />}
          {state && !state.ok && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {state.message}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              {pending ? "Einen Moment …" : "Probestunde absagen"}
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="border border-brand-300 px-4 py-2 text-sm text-brand-900 hover:bg-brand-50"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
