"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/lib/account-actions";
import { adminUpdateParticipant } from "@/lib/course-manage-actions";

const INPUT = "mt-1 w-full border border-brand-300 bg-white px-3 py-2";
const INITIAL: ActionResult = { ok: false };

// Name, muslimischer Name, E-Mail und Geburtsjahr eines Teilnehmers, durch den Admin.
export function ParticipantAdminForm({
  participant,
}: {
  participant: {
    id: string;
    relation: "SELF" | "CHILD" | "OTHER";
    name: string;
    muslimName: string;
    email: string;
    birthYear: string;
  };
}) {
  const [state, action, pending] = useActionState(adminUpdateParticipant, INITIAL);
  const error = (key: string) =>
    state.errors?.[key] ? <span className="mt-1 block text-sm text-red-700">{state.errors[key]}</span> : null;
  const isSelf = participant.relation === "SELF";

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="participantId" value={participant.id} />
      <label className="text-sm font-medium text-brand-700">
        Voller Name
        <input name="name" required defaultValue={participant.name} className={INPUT} />
        {error("name")}
      </label>
      <label className="text-sm font-medium text-brand-700">
        Muslimischer Name / Rufname (optional)
        <input name="muslimName" defaultValue={participant.muslimName} className={INPUT} />
        <span className="mt-1 block text-xs font-normal text-brand-600">Wird für die Anrede in E-Mails verwendet.</span>
        {error("muslimName")}
      </label>
      <label className="text-sm font-medium text-brand-700">
        E-Mail{participant.relation === "CHILD" ? " (optional)" : ""}
        <input
          name="email"
          type="email"
          defaultValue={participant.email}
          readOnly={isSelf}
          className={`${INPUT} ${isSelf ? "bg-brand-50 text-brand-600" : ""}`}
        />
        {isSelf && (
          <span className="mt-1 block text-xs font-normal text-brand-600">
            Anmeldeadresse des Kontos, hier nicht änderbar.
          </span>
        )}
        {error("email")}
      </label>
      {participant.relation === "CHILD" && (
        <label className="text-sm font-medium text-brand-700">
          Geburtsjahr
          <input name="birthYear" inputMode="numeric" defaultValue={participant.birthYear} className={INPUT} />
          {error("birthYear")}
        </label>
      )}

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`px-3 py-2 text-sm sm:col-span-2 ${state.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}
        >
          {state.message}
        </p>
      )}
      <button disabled={pending} className="btn-primary px-5 py-2.5 disabled:opacity-60 sm:col-span-2 sm:w-fit">
        {pending ? "Wird gespeichert …" : "Speichern"}
      </button>
    </form>
  );
}
