"use client";

import { useActionState } from "react";

import { saveNotificationPreferences, type PreferencesResult } from "@/lib/notification-actions";
import { NOTIFICATION_TYPE_INFO, type NotificationTypeKey } from "@/lib/notification-types";

// Ein Schalter pro Ereignistyp: zusätzlich per E-Mail informieren oder nur im Feed anzeigen.
export function NotificationSettingsForm({
  types,
  email,
  allCourses,
}: {
  types: NotificationTypeKey[];
  email: Record<string, boolean>;
  // Nur fuer Admins (sonst null): E-Mails auch fuer Kurse anderer Lehrkraefte
  allCourses: boolean | null;
}) {
  const [state, formAction, pending] = useActionState<PreferencesResult, FormData>(
    saveNotificationPreferences,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      {allCourses !== null && (
        <label className="flex items-start gap-3 border border-brand-200 bg-white p-4">
          <input
            name="notifyAllCourses"
            type="checkbox"
            defaultChecked={allCourses}
            className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
          />
          <span className="min-w-0">
            <span className="block font-medium text-brand-900">E-Mails auch für Kurse anderer Lehrkräfte</span>
            <span className="block text-sm text-brand-600">
              Aus: Ereignisse fremder Kurse erscheinen nur hier in der Liste. An: Es gelten die Einstellungen unten
              für alle Kurse.
            </span>
          </span>
        </label>
      )}
      <fieldset className="border border-brand-200 bg-white">
        <legend className="sr-only">E-Mail pro Ereignis</legend>
        <ul className="divide-y divide-brand-200">
          {types.map((type) => {
            const info = NOTIFICATION_TYPE_INFO[type];
            const id = `email_${type}`;
            return (
              <li key={type} className="flex items-start gap-3 p-4">
                <input
                  id={id}
                  name={id}
                  type="checkbox"
                  defaultChecked={email[type]}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-brand-600"
                />
                <label htmlFor={id} className="min-w-0">
                  <span className="block font-medium text-brand-900">{info.label}</span>
                  <span className="block text-sm text-brand-600">
                    {info.description}
                    {info.emailByDefault ? " Standard: per E-Mail." : " Standard: nur hier im Feed."}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="flex items-center gap-4">
        <button
          disabled={pending}
          className="bg-brand-700 px-4 py-2 font-medium text-white hover:bg-brand-800 disabled:opacity-60"
        >
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
