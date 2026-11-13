"use client";

import { useActionState, useState } from "react";

import { deleteAccount, type DeleteAccountResult } from "@/lib/account-admin-actions";

type Teacher = { id: string; name: string; email: string };

const SELECT = "mt-1 w-full border border-brand-300 bg-white px-3 py-2 text-sm";

// Sicherheitsabfrage: Der Loeschen-Knopf wird erst aktiv, wenn jeder Kurs (und ggf. die Mediathek)
// eine neue Lehrkraft hat und die E-Mail-Adresse des Kontos exakt eingetippt ist. Der Server prueft
// beides noch einmal.
export function DeleteAccountForm({
  userId,
  email,
  courses = [],
  mediaCount = 0,
  teachers = [],
}: {
  userId: string;
  email: string;
  courses?: { id: string; title: string; detail: string }[];
  mediaCount?: number;
  teachers?: Teacher[];
}) {
  const [state, formAction, pending] = useActionState<DeleteAccountResult, FormData>(deleteAccount, {});
  const [typed, setTyped] = useState("");
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [mediaTo, setMediaTo] = useState("");

  const allAssigned = courses.every((c) => targets[c.id]) && (mediaCount === 0 || mediaTo);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  // Wer den ersten Kurs uebernimmt, ist der naheliegende Vorschlag fuer die Mediathek.
  function assign(courseId: string, teacherId: string) {
    setTargets((prev) => ({ ...prev, [courseId]: teacherId }));
    if (!mediaTo && teacherId) setMediaTo(teacherId);
  }

  const options = (
    <>
      <option value="">Bitte wählen …</option>
      {teachers.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} ({t.email})
        </option>
      ))}
    </>
  );

  return (
    <form action={formAction} className="space-y-5 border border-red-300 bg-white p-5">
      <input type="hidden" name="userId" value={userId} />

      {courses.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="mb-1 text-sm font-semibold text-azure-800">
            Wer übernimmt die Kurse? ({courses.length})
          </legend>
          {courses.map((course) => (
            <label key={course.id} className="block text-sm text-brand-900">
              <span className="font-medium">{course.title}</span>{" "}
              <span className="text-brand-600">({course.detail})</span>
              <select
                name={`course_${course.id}`}
                value={targets[course.id] ?? ""}
                onChange={(e) => assign(course.id, e.target.value)}
                className={SELECT}
              >
                {options}
              </select>
            </label>
          ))}
        </fieldset>
      )}

      {mediaCount > 0 && (
        <label className="block text-sm text-brand-900">
          <span className="font-semibold text-azure-800">Wer übernimmt die Mediathek?</span>{" "}
          <span className="text-brand-600">({mediaCount} Dateien)</span>
          <select name="mediaTo" value={mediaTo} onChange={(e) => setMediaTo(e.target.value)} className={SELECT}>
            {options}
          </select>
        </label>
      )}

      <label className="block text-sm text-brand-900">
        Zur Bestätigung die E-Mail-Adresse des Kontos eintippen:{" "}
        <span className="break-all font-mono">{email}</span>
        <input
          name="confirmEmail"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="mt-1 w-full border border-brand-300 bg-white px-3 py-2 text-sm"
        />
      </label>

      {state.message && (
        <p role="alert" className="bg-red-50 px-3 py-2 text-sm text-red-900">
          {state.message}
        </p>
      )}
      {!allAssigned && (
        <p className="text-sm text-brand-600">Erst alle Kurse und die Mediathek zuordnen.</p>
      )}
      <button
        type="submit"
        disabled={!matches || !allAssigned || pending}
        className="bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Wird gelöscht …" : "Konto endgültig löschen"}
      </button>
    </form>
  );
}
