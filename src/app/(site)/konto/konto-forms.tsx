"use client";

import { useActionState, useState } from "react";

import { ConfirmButton } from "@/components/confirm-button";
import { CheckboxField } from "@/components/form/checkbox-field";
import { FloatingField } from "@/components/form/floating-field";
import { PasswordField } from "@/components/form/password-field";
import { PencilIcon, TrashIcon } from "@/components/icons";
import {
  changePassword,
  deleteParticipant,
  updateParticipant,
  updateProfile,
  type ActionResult,
} from "@/lib/account-actions";
import { childBirthYearRange } from "@/lib/participant-rules";

const INITIAL: ActionResult = { ok: false };

const PRIMARY_BUTTON =
  "h-11 rounded-md bg-brand-600 px-5 font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700 disabled:opacity-60";

// Rückmeldung nach dem Speichern: Erfolg grün, Fehler rot (Screenreader lesen sie vor).
function Feedback({ result }: { result: ActionResult }) {
  if (!result.message) return null;
  return (
    <p
      role={result.ok ? "status" : "alert"}
      className={`rounded-md px-3 py-2 text-sm ${
        result.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"
      }`}
    >
      {result.message}
    </p>
  );
}

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, INITIAL);
  // Eingaben als State halten: React leert unkontrollierte Felder nach jeder Formular-Aktion.
  const [value, setValue] = useState(name);
  return (
    <form action={action} className="space-y-4 rounded-lg border border-brand-200 bg-white p-5">
      <FloatingField
        id="profile-name"
        name="name"
        label="Vor- und Nachname"
        required
        autoComplete="name"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        error={state.errors?.name}
      />
      <div>
        <p className="text-sm text-brand-900/70">E-Mail-Adresse (Anmeldung und Zugangslinks)</p>
        <p className="font-medium text-brand-900">{email}</p>
        <p className="text-xs text-brand-900/60">
          Die Adresse lässt sich hier noch nicht ändern. Schreib uns, wenn sie sich geändert hat.
        </p>
      </div>
      <Feedback result={state} />
      <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
        {pending ? "Wird gespeichert …" : "Speichern"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [state, action, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await changePassword(prev, formData);
    // Nach Erfolg die Felder leeren, damit kein Passwort im Formular stehen bleibt.
    if (result.ok) {
      setCurrent("");
      setNext("");
    }
    return result;
  }, INITIAL);
  return (
    <form action={action} className="space-y-4 rounded-lg border border-brand-200 bg-white p-5">
      <PasswordField
        id="current-password"
        name="currentPassword"
        label="Aktuelles Passwort"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
        error={state.errors?.currentPassword}
      />
      <PasswordField
        id="new-password"
        name="newPassword"
        label="Neues Passwort"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
        showRules
        error={state.errors?.newPassword}
      />
      <Feedback result={state} />
      <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
        {pending ? "Wird geändert …" : "Passwort ändern"}
      </button>
    </form>
  );
}

type EditableParticipant = {
  id: string;
  name: string;
  relation: "SELF" | "CHILD" | "OTHER";
  birthYear: number | null;
  email: string | null;
  whatsapp: string | null;
  courses: string[];
};

const RELATION_LABELS = { SELF: "Du selbst", CHILD: "Kind", OTHER: "Andere Person" } as const;

export function ParticipantEditor({ participant }: { participant: EditableParticipant }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(updateParticipant, INITIAL);
  const [deleteState, deleteAction] = useActionState(deleteParticipant, INITIAL);
  // Alle Eingaben als State halten, damit sie nach einem Fehler nicht zurueckspringen.
  const [name, setName] = useState(participant.name);
  const [email, setEmail] = useState(participant.email ?? "");
  const [birthYear, setBirthYear] = useState(participant.birthYear ? String(participant.birthYear) : "");
  const [whatsapp, setWhatsapp] = useState(participant.whatsapp ?? "");
  const [consent, setConsent] = useState(Boolean(participant.whatsapp));
  const isSelf = participant.relation === "SELF";
  const range = childBirthYearRange();
  const fid = (field: string) => `participant-${participant.id}-${field}`;

  return (
    <div className="rounded-lg border border-brand-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div>
          <p className="font-semibold text-brand-900">
            {participant.name}{" "}
            <span className="text-sm font-normal text-brand-900/70">
              ({RELATION_LABELS[participant.relation]}
              {participant.birthYear ? `, Jahrgang ${participant.birthYear}` : ""})
            </span>
          </p>
          <p className="text-sm text-brand-900/75">
            {participant.courses.length > 0
              ? `Angemeldet in: ${participant.courses.join(", ")}`
              : "Aktuell in keinem Kurs angemeldet"}
          </p>
          {participant.whatsapp && (
            <p className="text-sm text-brand-900/75">WhatsApp: {participant.whatsapp}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => setEditing((value) => !value)}
            aria-expanded={editing}
            className="inline-flex items-center gap-1.5 font-medium text-azure-800 hover:text-azure-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700"
          >
            <PencilIcon />
            {editing ? "Schließen" : "Bearbeiten"}
          </button>
          {!isSelf && participant.courses.length === 0 && (
            <form action={deleteAction}>
              <input type="hidden" name="participantId" value={participant.id} />
              <ConfirmButton
                message={`„${participant.name}“ wirklich löschen?`}
                className="inline-flex items-center gap-1.5 font-medium text-red-800 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                <TrashIcon />
                Löschen
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>
      {deleteState.message && !deleteState.ok && (
        <div className="mt-3">
          <Feedback result={deleteState} />
        </div>
      )}

      {editing && (
        <form action={action} className="mt-4 space-y-4 border-t border-brand-100 pt-4">
          <input type="hidden" name="participantId" value={participant.id} />
          {isSelf ? (
            <p className="text-sm text-brand-900/75">
              Name und E-Mail kommen aus deinem Konto (siehe „Profil“). Hier kannst du nur die
              WhatsApp-Nummer ändern.
            </p>
          ) : (
            <>
              <FloatingField
                id={fid("name")}
                name="name"
                label="Name"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                error={state.errors?.name}
              />
              {participant.relation === "CHILD" && (
                <FloatingField
                  id={fid("birthYear")}
                  name="birthYear"
                  label="Geburtsjahr"
                  required
                  inputMode="numeric"
                  maxLength={4}
                  value={birthYear}
                  onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, ""))}
                  hint={`Jahrgang ${range.min} bis ${range.max}`}
                  error={state.errors?.birthYear}
                />
              )}
              <FloatingField
                id={fid("email")}
                name="email"
                type="email"
                label={participant.relation === "CHILD" ? "E-Mail-Adresse (optional)" : "E-Mail-Adresse"}
                required={participant.relation !== "CHILD"}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                hint={participant.relation === "CHILD" ? "Ohne eigene Adresse gehen Mails an dich." : undefined}
                error={state.errors?.email}
              />
            </>
          )}
          <div className="space-y-3 rounded-md bg-brand-50 p-4">
            <FloatingField
              id={fid("whatsapp")}
              name="whatsapp"
              type="tel"
              label="WhatsApp-Nummer (optional)"
              inputMode="tel"
              value={whatsapp}
              onChange={(event) => setWhatsapp(event.target.value)}
              hint="Zum Entfernen das Feld leeren und speichern."
              error={state.errors?.whatsapp}
            />
            {whatsapp.trim() && (
              <CheckboxField
                id={fid("whatsappConsent")}
                name="whatsappConsent"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                error={state.errors?.whatsappConsent}
              >
                Ich bin einverstanden, dass diese Nummer an die Lehrkraft weitergegeben wird und für
                die WhatsApp-Gruppe des Kurses verwendet wird. Die Einwilligung kann ich jederzeit
                widerrufen.
              </CheckboxField>
            )}
          </div>
          <Feedback result={state} />
          <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
            {pending ? "Wird gespeichert …" : "Speichern"}
          </button>
        </form>
      )}
    </div>
  );
}
