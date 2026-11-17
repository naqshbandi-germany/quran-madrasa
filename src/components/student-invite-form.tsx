"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";

import { CopyButton } from "@/components/copy-button";
import { PencilIcon, XIcon } from "@/components/icons";
import { inviteStudents, lookupInviteEmail, type StudentInviteState } from "@/lib/invite-actions";
import type { KnownInvitee } from "@/lib/invitees";

type Entry = { name: string; email: string };

const INPUT = "min-w-0 border border-brand-300 bg-white px-3 py-2 text-sm";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Mehrere Schueler auf einmal einladen: Name und E-Mail eingeben, Enter druecken. Der Eintrag
// steht dann als Text mit Bleistift (bearbeiten) und X (entfernen) da, darunter erscheint
// gleich ein leeres Feld fuer den naechsten Schueler.
export function StudentInviteForm({
  courseId,
  courses,
  initialCourseId = "",
  allowFree = false,
  timeZoneHint,
  trials = [],
  initialTrialId = "",
}: {
  // Fester Kurs oder Auswahl aus mehreren Kursen (Seite "Schüler einladen").
  courseId?: string;
  courses?: { id: string; title: string }[];
  initialCourseId?: string;
  allowFree?: boolean;
  // Hinweis, in welcher Zeitzone die Uhrzeit der Probestunde gilt, z. B. "deutsche Zeit".
  timeZoneHint?: string;
  // Kommende Probestunden, zu denen weitere Personen eingeladen werden koennen.
  trials?: { id: string; courseId: string; courseTitle: string; when: string; label: string }[];
  // Vorauswahl, z. B. ueber "Weitere einladen" unter "Termine".
  initialTrialId?: string;
}) {
  const [state, formAction, pending] = useActionState<StudentInviteState, FormData>(inviteStudents, null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState<Entry>({ name: "", email: "" });
  const [editing, setEditing] = useState<{ index: number; entry: Entry } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState(initialCourseId);
  const [trial, setTrial] = useState(Boolean(initialTrialId));
  // "neu" = neuen Termin anlegen, sonst die ID einer bestehenden Probestunde.
  const [trialChoice, setTrialChoice] = useState(initialTrialId || "neu");
  const [trialStartsAt, setTrialStartsAt] = useState("");
  const [trialDuration, setTrialDuration] = useState("30");
  const draftNameRef = useRef<HTMLInputElement>(null);
  const activeCourse = courseId ?? selectedCourse;
  // Ohne gewaehlten Kurs alle kommenden Probestunden anbieten (mit Kursname); die Auswahl
  // stellt dann den passenden Kurs ein.
  const courseTrials = activeCourse ? trials.filter((t) => t.courseId === activeCourse) : trials;
  const existingTrial = trial ? courseTrials.find((t) => t.id === trialChoice) : undefined;

  // Abgleich der eingetippten E-Mail-Adresse: bekannte Personen (Konto, Einladung, Probestunde)
  // werden angezeigt, damit niemand doppelt unter verschiedenen Namen eingeladen wird.
  const [known, setKnown] = useState<Record<string, KnownInvitee | null>>({});
  const draftEmail = draft.email.trim().toLowerCase();
  const lookupKey = `${activeCourse}|${draftEmail}`;
  useEffect(() => {
    if (!EMAIL_PATTERN.test(draftEmail) || lookupKey in known) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await lookupInviteEmail(draftEmail, activeCourse).catch(() => null);
      if (!cancelled) setKnown((k) => ({ ...k, [lookupKey]: result }));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draftEmail, activeCourse, lookupKey, known]);
  const draftKnown = EMAIL_PATTERN.test(draftEmail) ? known[lookupKey] : undefined;

  function validate(entry: Entry, exceptIndex = -1) {
    const e = { name: entry.name.trim(), email: entry.email.trim() };
    if (!e.name && !e.email) return null;
    if (e.email && !EMAIL_PATTERN.test(e.email)) {
      setError(`„${e.email}“ ist keine gültige E-Mail-Adresse.`);
      return null;
    }
    const duplicate =
      e.email &&
      entries.some((x, i) => i !== exceptIndex && x.email.toLowerCase() === e.email.toLowerCase());
    if (duplicate) {
      setError(`„${e.email}“ steht schon in der Liste.`);
      return null;
    }
    setError(null);
    return e;
  }

  function addDraft() {
    const entry = validate(draft);
    if (!entry) return;
    setEntries((list) => [...list, entry]);
    setDraft({ name: "", email: "" });
    draftNameRef.current?.focus();
  }

  function saveEdit() {
    if (!editing) return;
    const entry = validate(editing.entry, editing.index);
    if (!entry) {
      if (!editing.entry.name.trim() && !editing.entry.email.trim()) {
        setEntries((list) => list.filter((_, i) => i !== editing.index));
        setEditing(null);
      }
      return;
    }
    setEntries((list) => list.map((e, i) => (i === editing.index ? entry : e)));
    setEditing(null);
    draftNameRef.current?.focus();
  }

  // Enter uebernimmt den Eintrag statt das Formular abzuschicken.
  function onEnter(e: KeyboardEvent<HTMLInputElement>, save: () => void) {
    if (e.key === "Enter") {
      e.preventDefault();
      save();
    }
    if (e.key === "Escape" && editing) {
      e.preventDefault();
      setEditing(null);
    }
  }

  // Beim Abschicken zaehlt auch ein noch nicht mit Enter bestaetigter Eintrag.
  const pendingDraft = draft.name.trim() || draft.email.trim() ? [{ name: draft.name.trim(), email: draft.email.trim() }] : [];
  const allEntries = [...entries, ...pendingDraft];

  function onSubmit() {
    setEditing(null);
  }

  // Nach erfolgreichem Versand die Liste leeren (einmal pro neuem Ergebnis).
  const [handled, setHandled] = useState<StudentInviteState>(null);
  if (state !== handled) {
    setHandled(state);
    // Nach dem Absenden ist die Person ggf. neu bekannt (Einladung, Probestunde): neu abfragen.
    setKnown({});
    if (state?.ok) {
      setEntries([]);
      setDraft({ name: "", email: "" });
      // React setzt das Formular nach dem Absenden zurück; die Kursauswahl entsprechend leeren.
      setSelectedCourse(initialCourseId);
      setTrial(Boolean(initialTrialId));
      setTrialChoice(initialTrialId || "neu");
      setTrialStartsAt("");
    }
  }

  return (
    <div className="space-y-3">
      <form action={formAction} onSubmit={onSubmit} className="space-y-3">
        {courseId ? (
          <input type="hidden" name="courseId" value={courseId} />
        ) : (
          <select
            name="courseId"
            required
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              setTrialChoice("neu");
            }}
            aria-label="Kurs" className={`${INPUT} w-full sm:w-auto`}>
            <option value="" disabled>
              Kurs wählen …
            </option>
            {(courses ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        )}
        <input type="hidden" name="students" value={JSON.stringify(allEntries)} />

        {entries.length > 0 && (
          <ul className="space-y-1" aria-label="Schüler, die eingeladen werden">
            {entries.map((entry, index) =>
              editing?.index === index ? (
                <li key={index} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    autoFocus
                    aria-label="Name bearbeiten"
                    value={editing.entry.name}
                    onChange={(e) => setEditing({ index, entry: { ...editing.entry, name: e.target.value } })}
                    onKeyDown={(e) => onEnter(e, saveEdit)}
                    className={INPUT}
                  />
                  <input
                    type="email"
                    aria-label="E-Mail-Adresse bearbeiten"
                    value={editing.entry.email}
                    onChange={(e) => setEditing({ index, entry: { ...editing.entry, email: e.target.value } })}
                    onKeyDown={(e) => onEnter(e, saveEdit)}
                    className={INPUT}
                  />
                  <button type="button" onClick={saveEdit} className="px-3 py-2 text-sm font-medium text-brand-700 underline">
                    Übernehmen
                  </button>
                </li>
              ) : (
                <li key={index} className="flex items-center gap-2 px-1 py-1.5 text-sm text-brand-900">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{entry.name || "Ohne Namen"}</span>
                    {entry.email && <span className="text-brand-600"> · {entry.email}</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditing({ index, entry })}
                    aria-label={`${entry.name || entry.email} bearbeiten`}
                    className="rounded p-1.5 text-brand-600 hover:bg-brand-100 hover:text-brand-900"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntries((list) => list.filter((_, i) => i !== index))}
                    aria-label={`${entry.name || entry.email} entfernen`}
                    className="rounded p-1.5 text-brand-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </li>
              ),
            )}
          </ul>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <input
            ref={draftNameRef}
            aria-label={entries.length ? "Name eines weiteren Schülers" : "Name des Schülers"}
            placeholder={entries.length ? "Weiteren Schüler einladen (Name)" : "Name des Schülers"}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            onKeyDown={(e) => onEnter(e, addDraft)}
            className={INPUT}
          />
          <input
            type="email"
            aria-label="E-Mail-Adresse"
            placeholder="E-Mail-Adresse"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            onKeyDown={(e) => onEnter(e, addDraft)}
            className={INPUT}
          />
        </div>
        {draftKnown && (
          <div role="status" className="space-y-1 border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-950">
            <p>
              <span className="font-semibold">Bereits bekannt: {draftKnown.name || draftKnown.email}</span>
              {draftKnown.hasAccount && " · hat ein Konto"}
              {draftKnown.enrolledHere && " · ist in diesem Kurs angemeldet"}
            </p>
            {draftKnown.notes.length > 0 && (
              <ul className="list-disc pl-5 text-xs">
                {draftKnown.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
            {draftKnown.enrolledHere && !trial && (
              <p className="text-xs">Eine Einladung zur Anmeldung ist nicht nötig.</p>
            )}
            {draftKnown.inviteName && draftKnown.inviteName !== draft.name.trim() && (
              <button
                type="button"
                onClick={() => setDraft({ ...draft, name: draftKnown.inviteName })}
                className="text-xs font-medium text-orange-900 underline"
              >
                Name „{draftKnown.inviteName}“ übernehmen
              </button>
            )}
          </div>
        )}
        <p className="text-xs text-brand-600">
          Mit Enter übernehmen, dann den nächsten Schüler eingeben. Für den Versand per E-Mail sind Name und
          E-Mail nötig; für Links reicht der Name (oder gar nichts).
        </p>
        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-3 border border-brand-200 bg-brand-50 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-brand-900">
            <input
              type="checkbox"
              name="trial"
              checked={trial}
              onChange={(e) => setTrial(e.target.checked)}
              className="h-4 w-4"
            />
            Zu einer kostenlosen Probestunde einladen (statt zur Anmeldung)
          </label>
          {trial && (
            <div className="space-y-2 pl-6">
              {courseTrials.length > 0 && (
                <label className="block text-sm text-brand-800">
                  Termin
                  <select
                    name="trialId"
                    value={trialChoice}
                    onChange={(e) => {
                      setTrialChoice(e.target.value);
                      const picked = trials.find((t) => t.id === e.target.value);
                      if (picked && !courseId) setSelectedCourse(picked.courseId);
                    }}
                    className={`${INPUT} mt-1 block`}
                  >
                    <option value="neu">Neuen Termin anlegen</option>
                    {courseTrials.map((t) => (
                      <option key={t.id} value={t.id}>
                        Bestehende Probestunde: {activeCourse ? "" : `${t.courseTitle}, `}
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {existingTrial ? (
                <p className="text-xs text-brand-600">
                  Die Eingeladenen kommen zur bestehenden Probestunde am {existingTrial.when} dazu und bekommen
                  denselben Link zum Unterrichtsraum.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    <label className="text-sm text-brand-800">
                      Datum und Uhrzeit
                      <input
                        type="datetime-local"
                        name="trialStartsAt"
                        required
                        value={trialStartsAt}
                        onChange={(e) => setTrialStartsAt(e.target.value)}
                        className={`${INPUT} mt-1 block`}
                      />
                    </label>
                    <label className="text-sm text-brand-800">
                      Dauer
                      <select
                        name="trialDuration"
                        value={trialDuration}
                        onChange={(e) => setTrialDuration(e.target.value)}
                        className={`${INPUT} mt-1 block`}
                      >
                        <option value="30">30 Minuten</option>
                        <option value="45">45 Minuten</option>
                        <option value="60">60 Minuten</option>
                      </select>
                    </label>
                  </div>
                  <p className="text-xs text-brand-600">
                    Ein gemeinsamer Termin für alle Eingeladenen{timeZoneHint ? `, Uhrzeit in ${timeZoneHint}` : ""}. Die
                    Eingeladenen brauchen kein Konto: Sie bekommen den Link zum Unterrichtsraum mit Kalendereintrag und werden
                    einen Tag und eine Stunde vorher erinnert. Die Probestunde erscheint unter „Termine“.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {allowFree && !trial && (
          <label className="flex items-center gap-2 text-sm text-brand-800">
            <input type="checkbox" name="free" className="h-4 w-4" />
            Ohne Zahlung eintragen (nur Admins, jeder Link einmal nutzbar)
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            name="delivery"
            value="mail"
            disabled={pending}
            className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
          >
            {allEntries.length > 1 ? `${allEntries.length} Schüler per E-Mail einladen` : "Per E-Mail einladen"}
          </button>
          <button
            type="submit"
            name="delivery"
            value="link"
            disabled={pending}
            className="border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-900 hover:bg-brand-50 disabled:opacity-60"
          >
            {trial
              ? "Nachricht für WhatsApp erstellen"
              : allEntries.length > 1
                ? `${allEntries.length} Links erstellen`
                : "Link erstellen"}
          </button>
          {pending && <span className="self-center text-sm text-brand-600">Einen Moment …</span>}
        </div>
      </form>

      {state && (
        <div
          role={state.ok ? "status" : "alert"}
          className={`space-y-3 border px-3 py-2 text-sm ${state.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-800"}`}
        >
          <p>{state.message}</p>
          {state.results && state.results.length > 0 && (
            <ul className="space-y-3">
              {state.results.map((r, i) => (
                <li key={i} className="space-y-1">
                  {state.results!.length > 1 && (
                    <p className={r.ok ? "font-medium" : "font-medium text-red-800"}>
                      {r.name || r.email || "Link ohne Namen"}
                      {!r.ok && `: ${r.message}`}
                    </p>
                  )}
                  {!r.link && r.shareText && (
                    <div className="flex flex-wrap items-center gap-3">
                      <CopyButton text={r.shareText} label="Nachricht kopieren" />
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(r.shareText)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-azure-800 underline"
                      >
                        Per WhatsApp teilen
                      </a>
                    </div>
                  )}
                  {r.link && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        readOnly
                        value={r.link}
                        aria-label={`Einladungslink ${r.name}`.trim()}
                        onFocus={(e) => e.currentTarget.select()}
                        className="min-w-0 flex-1 border border-brand-300 bg-white px-2 py-1 font-mono text-xs text-brand-900"
                      />
                      <CopyButton text={r.link} label="Link kopieren" />
                      {r.shareText && (
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(r.shareText)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-azure-800 underline"
                        >
                          Per WhatsApp teilen
                        </a>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
