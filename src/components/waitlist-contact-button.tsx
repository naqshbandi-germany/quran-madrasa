"use client";

import { useState, useTransition } from "react";

import { contactWaitlistEntry } from "@/lib/waitlist-actions";

// "Anschreiben" in der Warteliste: fragt per E-Mail, ob das Interesse weiterhin besteht.
export function WaitlistContactButton({ entryId, name }: { entryId: string; name: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  return (
    <span className="inline-flex items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`${name} per E-Mail fragen, ob das Interesse an einem Platz weiterhin besteht?`)) return;
          startTransition(async () => {
            const r = await contactWaitlistEntry(entryId);
            setResult({ ok: r.ok, message: r.message ?? (r.ok ? "Angeschrieben." : "Das hat nicht geklappt.") });
          });
        }}
        className="btn-primary btn-display px-4 py-1.5 text-lg disabled:opacity-60"
      >
        {pending ? "Wird gesendet …" : "Anschreiben"}
      </button>
      {result && (
        <span role="status" className={`text-xs font-medium ${result.ok ? "text-brand-700" : "text-red-700"}`}>
          {result.message}
        </span>
      )}
    </span>
  );
}
