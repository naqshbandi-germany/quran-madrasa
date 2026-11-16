"use client";

import { useActionState } from "react";

import { updateOwnTimeZone, type TimeZoneResult } from "@/lib/teacher-profile-actions";
import { TIME_ZONE_OPTIONS } from "@/lib/time-zones";

export function TimeZoneForm({ timeZone }: { timeZone: string }) {
  const [state, action, pending] = useActionState<TimeZoneResult, FormData>(updateOwnTimeZone, null);
  return (
    <form action={action} className="space-y-3">
      <label className="flex flex-col text-sm text-brand-800">
        Zeitzone
        <select name="timeZone" defaultValue={timeZone} className="mt-1 max-w-sm border border-brand-300 bg-white px-3 py-2">
          {TIME_ZONE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center gap-4">
        <button disabled={pending} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
          {pending ? "Wird gespeichert …" : "Speichern"}
        </button>
        {state && (
          <p role="status" className={`text-sm ${state.ok ? "text-brand-700" : "text-red-700"}`}>
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
