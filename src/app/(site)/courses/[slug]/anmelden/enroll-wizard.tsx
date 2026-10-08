"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { CheckboxField } from "@/components/form/checkbox-field";
import { FloatingField } from "@/components/form/floating-field";
import { FormAlert } from "@/components/form/form-alert";
import {
  MAX_PARTICIPANTS_PER_ORDER,
  childBirthYearRange,
  emptyParticipantInput,
  validateParticipant,
  type ParticipantErrors,
  type ParticipantInput,
  type ParticipantRelationValue,
} from "@/lib/participant-rules";

type SavedParticipant = {
  id: string;
  name: string;
  relation: ParticipantRelationValue;
  birthYear: number | null;
  enrolled: boolean;
};

type Props = {
  course: { id: string; slug: string; title: string; priceCents: number; currency: string };
  account: { name: string; email: string };
  participants: SavedParticipant[];
};

type Draft = { key: number; input: ParticipantInput; errors: ParticipantErrors };

const RELATION_LABELS: Record<ParticipantRelationValue, string> = {
  SELF: "Du selbst",
  CHILD: "Kind",
  OTHER: "Andere Person",
};

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

const PRIMARY_BUTTON =
  "h-12 rounded-md bg-brand-600 px-6 font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700 disabled:opacity-60";
const SECONDARY_BUTTON =
  "h-12 rounded-md border border-brand-200 bg-white px-6 font-medium text-brand-900 transition hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700";

export function EnrollWizard({ course, account, participants }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [formError, setFormError] = useState<ReactNode>(null);
  const [loading, setLoading] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const hasSelf = participants.some((p) => p.relation === "SELF") || drafts.some((d) => d.input.relation === "SELF");
  const count = selected.size + drafts.length;
  const total = count * course.priceCents;

  // Beim Schrittwechsel die Ueberschrift fokussieren (Screenreader und Tastatur).
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  function toggleSaved(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addDraft(relation: ParticipantRelationValue) {
    const input = emptyParticipantInput(relation);
    if (relation === "SELF") {
      input.name = account.name;
      input.email = account.email;
    }
    setDrafts((current) => [...current, { key: nextKey, input, errors: {} }]);
    setNextKey((k) => k + 1);
  }

  function updateDraft(key: number, patch: Partial<ParticipantInput>) {
    setDrafts((current) =>
      current.map((draft) => {
        if (draft.key !== key) return draft;
        // Fehler der geaenderten Felder ausblenden
        const errors = { ...draft.errors };
        for (const field of Object.keys(patch)) delete (errors as Record<string, unknown>)[field];
        return { ...draft, input: { ...draft.input, ...patch }, errors };
      }),
    );
  }

  function removeDraft(key: number) {
    setDrafts((current) => current.filter((draft) => draft.key !== key));
  }

  function goToSummary() {
    setFormError(null);
    if (count === 0) {
      setFormError("Bitte wähle mindestens einen Teilnehmer aus oder füge einen hinzu.");
      return;
    }
    if (count > MAX_PARTICIPANTS_PER_ORDER) {
      setFormError(`Pro Anmeldung sind höchstens ${MAX_PARTICIPANTS_PER_ORDER} Teilnehmer möglich.`);
      return;
    }

    let firstInvalid: { key: number; field: string } | null = null;
    const checked = drafts.map((draft) => {
      const { errors } = validateParticipant(draft.input);
      const field = Object.keys(errors)[0];
      if (field && !firstInvalid) firstInvalid = { key: draft.key, field };
      return { ...draft, errors };
    });
    setDrafts(checked);
    if (firstInvalid) {
      const { key, field } = firstInvalid;
      requestAnimationFrame(() => document.getElementById(`draft-${key}-${field}`)?.focus());
      return;
    }
    setStep(2);
  }

  async function submit() {
    setFormError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/enrollments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          existingParticipantIds: [...selected],
          newParticipants: drafts.map((draft) => draft.input),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.fieldErrors) {
        const byIndex = data.fieldErrors as Record<string, ParticipantErrors>;
        setDrafts((current) =>
          current.map((draft, index) => ({ ...draft, errors: byIndex[index] ?? {} })),
        );
        setStep(1);
      }
      setFormError(data.error ?? "Die Anmeldung konnte nicht gestartet werden. Bitte versuche es erneut.");
    } catch {
      setFormError("Die Anmeldung konnte nicht gestartet werden. Bitte versuche es in einem Moment noch einmal.");
    } finally {
      setLoading(false);
    }
  }

  const summaryRows = [
    ...participants
      .filter((p) => selected.has(p.id))
      .map((p) => ({ key: p.id, name: p.name, relation: p.relation })),
    ...drafts.map((d) => ({ key: `draft-${d.key}`, name: d.input.name.trim(), relation: d.input.relation })),
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.18em] text-azure-700">Anmeldung</p>
      <h1 className="mt-1 text-3xl font-semibold leading-tight text-brand-900">{course.title}</h1>
      <p className="mt-1 text-brand-900/75">
        {formatPrice(course.priceCents, course.currency)} pro Teilnehmer und Monat · monatlich
        kündbar
      </p>

      <ol className="mt-6 flex gap-3 text-sm" aria-label="Fortschritt">
        {[
          { n: 1, label: "Teilnehmer" },
          { n: 2, label: "Prüfen und anmelden" },
        ].map(({ n, label }) => (
          <li
            key={n}
            aria-current={step === n ? "step" : undefined}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 ${
              step === n ? "border-brand-600 bg-brand-600 text-white" : "border-brand-200 text-brand-900/70"
            }`}
          >
            <span className="font-semibold">{n}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 space-y-5">
        <FormAlert>{formError}</FormAlert>

        {step === 1 && (
          <>
            <div>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-semibold text-brand-900 outline-none"
              >
                Wen meldest du an?
              </h2>
              <p className="mt-1 text-brand-900/75">
                Du kannst dich selbst, deine Kinder oder andere Personen anmelden, auch mehrere
                zugleich. Dein Konto ({account.email}) bucht und bezahlt, du musst nicht selbst
                teilnehmen.
              </p>
            </div>

            {participants.length > 0 && (
              <fieldset className="space-y-2">
                <legend className="text-sm font-semibold text-brand-900">Bereits angelegt</legend>
                {participants.map((p) => (
                  <label
                    key={p.id}
                    className={`flex items-start gap-3 rounded-md border bg-white p-3 ${
                      p.enrolled ? "border-brand-200 opacity-70" : "cursor-pointer border-brand-200 hover:border-azure-700"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-5 w-5 accent-brand-600"
                      checked={selected.has(p.id)}
                      disabled={p.enrolled}
                      onChange={() => toggleSaved(p.id)}
                    />
                    <span className="text-sm">
                      <span className="font-medium text-brand-900">{p.name}</span>{" "}
                      <span className="text-brand-900/70">
                        ({RELATION_LABELS[p.relation]}
                        {p.birthYear ? `, Jahrgang ${p.birthYear}` : ""})
                      </span>
                      {p.enrolled && (
                        <span className="block text-brand-900/70">Schon in diesem Kurs angemeldet</span>
                      )}
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {drafts.map((draft, index) => (
              <DraftCard
                key={draft.key}
                draft={draft}
                position={index + 1}
                onChange={(patch) => updateDraft(draft.key, patch)}
                onRemove={() => removeDraft(draft.key)}
              />
            ))}

            <div>
              <p className="text-sm font-semibold text-brand-900">Person hinzufügen</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {!hasSelf && (
                  <AddButton title="Mich selbst" hint="Ich nehme teil" onClick={() => addDraft("SELF")} />
                )}
                <AddButton
                  title="Mein Kind"
                  hint="Kinder und Jugendliche unter 18"
                  onClick={() => addDraft("CHILD")}
                />
                <AddButton
                  title="Andere Person"
                  hint="Eine erwachsene Person"
                  onClick={() => addDraft("OTHER")}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-brand-200 pt-5">
              <p className="text-sm text-brand-900/75" aria-live="polite">
                {count === 0
                  ? "Noch niemand ausgewählt"
                  : `${count} Teilnehmer ausgewählt`}
              </p>
              <button type="button" onClick={goToSummary} className={PRIMARY_BUTTON}>
                Weiter
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-2xl font-semibold text-brand-900 outline-none"
              >
                Prüfen und anmelden
              </h2>
              <p className="mt-1 text-brand-900/75">
                Bitte kontrolliere deine Angaben, bevor du zur sicheren Zahlung bei Stripe
                weitergeleitet wirst.
              </p>
            </div>

            <div className="rounded-lg border border-brand-200 bg-white p-5">
              <h3 className="font-semibold text-brand-900">{course.title}</h3>
              <ul className="mt-3 divide-y divide-brand-100">
                {summaryRows.map((row) => (
                  <li key={row.key} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium text-brand-900">{row.name}</span>{" "}
                      <span className="text-brand-900/70">({RELATION_LABELS[row.relation]})</span>
                    </span>
                    <span>{formatPrice(course.priceCents, course.currency)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-center justify-between border-t border-brand-200 pt-3 font-semibold text-brand-900">
                <span>Gesamt pro Monat</span>
                <span>{formatPrice(total, course.currency)}</span>
              </p>
              <p className="mt-2 text-sm text-brand-900/75">
                Monatlich kündbar, keine Mindestlaufzeit. Die Abrechnung erfolgt monatlich über
                Stripe, die erste Zahlung wird sofort fällig.
              </p>
            </div>

            <p className="text-sm text-brand-900/75">
              Mit einem Klick auf „Zahlungspflichtig anmelden“ schließt du ein kostenpflichtiges
              Abo für die oben genannten Teilnehmer ab. Details zur Verarbeitung der Daten findest
              du in der{" "}
              <Link href="/datenschutz" target="_blank" className="font-medium underline">
                Datenschutzerklärung
              </Link>
              .
            </p>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-200 pt-5">
              <button
                type="button"
                onClick={() => {
                  setFormError(null);
                  setStep(1);
                }}
                className={SECONDARY_BUTTON}
                disabled={loading}
              >
                Zurück
              </button>
              <button type="button" onClick={submit} disabled={loading} className={PRIMARY_BUTTON}>
                {loading ? "Einen Moment …" : "Zahlungspflichtig anmelden"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AddButton({ title, hint, onClick }: { title: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-dashed border-brand-400 bg-white p-3 text-left transition hover:border-azure-700 hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700"
    >
      <span className="block font-medium text-brand-900">+ {title}</span>
      <span className="block text-sm text-brand-900/70">{hint}</span>
    </button>
  );
}

function DraftCard({
  draft,
  position,
  onChange,
  onRemove,
}: {
  draft: Draft;
  position: number;
  onChange: (patch: Partial<ParticipantInput>) => void;
  onRemove: () => void;
}) {
  const { input, errors, key } = draft;
  const id = (field: string) => `draft-${key}-${field}`;
  const range = childBirthYearRange();

  const titles: Record<ParticipantRelationValue, string> = {
    SELF: "Du selbst",
    CHILD: "Kind",
    OTHER: "Andere erwachsene Person",
  };

  return (
    <section
      aria-labelledby={id("title")}
      className="space-y-4 rounded-lg border border-brand-200 bg-white p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 id={id("title")} className="font-semibold text-brand-900">
          Teilnehmer neu: {titles[input.relation]}
          <span className="sr-only"> (Nr. {position})</span>
        </h3>
        <button
          type="button"
          onClick={onRemove}
          className="text-sm font-medium text-azure-800 underline underline-offset-2 hover:text-azure-700"
        >
          Entfernen
        </button>
      </div>

      {input.relation === "SELF" ? (
        <p className="text-sm text-brand-900/80">
          Du nimmst mit deinem Konto teil: <strong>{account(input)}</strong>. Die Zugangslinks
          kommen an diese Adresse.
        </p>
      ) : (
        <>
          <FloatingField
            id={id("name")}
            label={input.relation === "CHILD" ? "Name des Kindes" : "Vor- und Nachname"}
            required
            autoComplete="off"
            value={input.name}
            onChange={(event) => onChange({ name: event.target.value })}
            error={errors.name}
          />
          {input.relation === "CHILD" && (
            <FloatingField
              id={id("birthYear")}
              label="Geburtsjahr"
              required
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              value={input.birthYear}
              onChange={(event) => onChange({ birthYear: event.target.value.replace(/\D/g, "") })}
              hint={`Jahrgang ${range.min} bis ${range.max}. Wir fragen nur das Jahr ab.`}
              error={errors.birthYear}
            />
          )}
          <FloatingField
            id={id("email")}
            type="email"
            label={input.relation === "CHILD" ? "E-Mail-Adresse des Kindes (optional)" : "E-Mail-Adresse"}
            required={input.relation !== "CHILD"}
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            autoComplete="off"
            value={input.email}
            onChange={(event) => onChange({ email: event.target.value })}
            hint={
              input.relation === "CHILD"
                ? "Ohne eigene Adresse gehen alle Mails und Zugangslinks an dich."
                : "Hierhin schicken wir die Zugangslinks und Erinnerungen."
            }
            error={errors.email}
          />
        </>
      )}

      <div className="space-y-3 rounded-md bg-brand-50 p-4">
        <FloatingField
          id={id("whatsapp")}
          type="tel"
          label="WhatsApp-Nummer (optional)"
          inputMode="tel"
          autoComplete="off"
          value={input.whatsapp}
          onChange={(event) => onChange({ whatsapp: event.target.value })}
          hint={
            <>
              Für jeden Kurs richten wir eine WhatsApp-Gruppe für Ankündigungen ein.
              {input.relation === "CHILD" ? " Bei Kindern bitte die Nummer der Eltern angeben." : ""}
            </>
          }
          error={errors.whatsapp}
        />
        {input.whatsapp.trim() && (
          <CheckboxField
            id={id("whatsappConsent")}
            checked={input.whatsappConsent}
            onChange={(event) => onChange({ whatsappConsent: event.target.checked })}
            error={errors.whatsappConsent}
          >
            Ich bin einverstanden, dass diese Nummer an die Lehrkraft weitergegeben wird und für
            die WhatsApp-Gruppe des Kurses verwendet wird. Die Einwilligung kann ich jederzeit
            widerrufen.
          </CheckboxField>
        )}
      </div>

      {input.relation === "CHILD" && (
        <CheckboxField
          id={id("consentConfirmed")}
          checked={input.consentConfirmed}
          onChange={(event) => onChange({ consentConfirmed: event.target.checked })}
          error={errors.consentConfirmed}
        >
          Ich bin für dieses Kind sorgeberechtigt und melde es verbindlich zum Kurs an.
        </CheckboxField>
      )}
      {input.relation === "OTHER" && (
        <CheckboxField
          id={id("consentConfirmed")}
          checked={input.consentConfirmed}
          onChange={(event) => onChange({ consentConfirmed: event.target.checked })}
          error={errors.consentConfirmed}
        >
          Die Person ist mindestens 18 Jahre alt und mit der Anmeldung und der Weitergabe ihrer
          Daten an die Kursleitung einverstanden.
        </CheckboxField>
      )}
    </section>
  );
}

function account(input: ParticipantInput) {
  return `${input.name} (${input.email})`;
}
