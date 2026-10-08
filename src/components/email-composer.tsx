"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { FileIcon } from "@/components/icons";
import { sendCourseEmail } from "@/lib/email-actions";
import type { ActionResult } from "@/lib/account-actions";
import { formatBytes } from "@/lib/media";

export type ComposerCourse = {
  id: string;
  title: string;
  participants: { id: string; name: string; detail: string }[];
};

export type ComposerFile = { id: string; title: string; fileName: string; sizeBytes: number; asLink: boolean };

const INITIAL: ActionResult = { ok: false };
const INPUT = "w-full rounded-md border border-brand-200 bg-white px-3 py-2";

// E-Mail an Kursteilnehmer: Kurs waehlen (oder fest vorgegeben), an alle oder einzelne
// Teilnehmer, Betreff und Text, Dateien aus der Mediathek als Anhang.
export function EmailComposer({
  courses,
  files,
  initialCourseId,
}: {
  courses: ComposerCourse[];
  files: ComposerFile[];
  initialCourseId?: string;
}) {
  // Vorauswahl: gewuenschter Kurs, sonst der erste Kurs mit Teilnehmern.
  const [courseId, setCourseId] = useState(
    initialCourseId ?? courses.find((c) => c.participants.length > 0)?.id ?? courses[0]?.id ?? "",
  );
  const [mode, setMode] = useState<"all" | "selected">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attached, setAttached] = useState<Set<string>>(new Set());
  const [state, action, pending] = useActionState(async (prev: ActionResult, formData: FormData) => {
    const result = await sendCourseEmail(prev, formData);
    // Nach dem Versand das Formular leeren, damit nichts versehentlich doppelt rausgeht.
    if (result.ok) {
      setSubject("");
      setMessage("");
      setAttached(new Set());
    }
    return result;
  }, INITIAL);

  const course = courses.find((c) => c.id === courseId);
  const participants = course?.participants ?? [];
  const recipientCount = mode === "all" ? participants.length : selected.size;
  const attachedBytes = files
    .filter((f) => attached.has(f.id) && !f.asLink)
    .reduce((sum, f) => sum + f.sizeBytes, 0);
  const linkCount = files.filter((f) => attached.has(f.id) && f.asLink).length;

  function toggle(set: Set<string>, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  if (courses.length === 0) {
    return <p className="text-sm text-brand-600">Es gibt noch keinen Kurs, an dessen Teilnehmer du schreiben könntest.</p>;
  }

  return (
    <form action={action} className="space-y-5 rounded-lg border border-brand-200 bg-white p-5">
      {/* Kurs */}
      {courses.length > 1 ? (
        <label className="flex flex-col text-sm font-medium text-brand-700">
          Kurs
          <select
            name="courseId"
            value={courseId}
            onChange={(event) => {
              setCourseId(event.target.value);
              setSelected(new Set());
            }}
            className={`mt-1 ${INPUT}`}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.participants.length} Teilnehmer)
              </option>
            ))}
          </select>
          {state.errors?.courseId && <span className="mt-1 text-red-700">{state.errors.courseId}</span>}
        </label>
      ) : (
        <input type="hidden" name="courseId" value={courseId} />
      )}

      {/* Empfaenger */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-brand-700">Empfänger</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="mode"
            value="all"
            checked={mode === "all"}
            onChange={() => setMode("all")}
            className="h-4 w-4 accent-brand-600"
          />
          Alle Teilnehmer des Kurses ({participants.length})
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="mode"
            value="selected"
            checked={mode === "selected"}
            onChange={() => setMode("selected")}
            className="h-4 w-4 accent-brand-600"
          />
          Einzelne Teilnehmer auswählen
        </label>

        {mode === "selected" && (
          <div className="ml-6 rounded-md border border-brand-100 bg-brand-50 p-3">
            {participants.length === 0 ? (
              <p className="text-sm text-brand-600">In diesem Kurs sind noch keine Teilnehmer angemeldet.</p>
            ) : (
              <>
                <div className="mb-2 flex gap-4 text-sm">
                  <button
                    type="button"
                    onClick={() => setSelected(new Set(participants.map((p) => p.id)))}
                    className="font-medium text-azure-800 underline"
                  >
                    Alle auswählen
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelected(new Set())}
                    className="font-medium text-azure-800 underline"
                  >
                    Keine
                  </button>
                </div>
                <ul className="space-y-1.5">
                  {participants.map((p) => (
                    <li key={p.id}>
                      <label className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="participantIds"
                          value={p.id}
                          checked={selected.has(p.id)}
                          onChange={() => setSelected((current) => toggle(current, p.id))}
                          className="mt-0.5 h-4 w-4 accent-brand-600"
                        />
                        <span>
                          <span className="font-medium">{p.name}</span>{" "}
                          <span className="text-brand-600">{p.detail}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
        {state.errors?.participantIds && <p className="text-sm text-red-700">{state.errors.participantIds}</p>}
      </fieldset>

      {/* Inhalt */}
      <div className="space-y-3">
        <label className="flex flex-col text-sm font-medium text-brand-700">
          Betreff
          <input
            name="subject"
            required
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            className={`mt-1 ${INPUT}`}
          />
          {state.errors?.subject && <span className="mt-1 text-red-700">{state.errors.subject}</span>}
        </label>
        <label className="flex flex-col text-sm font-medium text-brand-700">
          Nachricht
          <textarea
            name="message"
            required
            rows={7}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className={`mt-1 ${INPUT}`}
          />
          {state.errors?.message && <span className="mt-1 text-red-700">{state.errors.message}</span>}
        </label>
      </div>

      {/* Anhaenge aus der Mediathek */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-brand-700">Anhänge aus der Mediathek</legend>
        {files.length === 0 ? (
          <p className="text-sm text-brand-600">
            Noch keine Dateien in deiner Mediathek.{" "}
            <Link href="/teacher/mediathek" className="font-medium text-azure-800 underline">
              Datei hochladen
            </Link>
          </p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {files.map((f) => (
                <li key={f.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="fileIds"
                      value={f.id}
                      checked={attached.has(f.id)}
                      onChange={() => setAttached((current) => toggle(current, f.id))}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <FileIcon className="h-4 w-4 text-brand-600" />
                    <span className="font-medium">{f.title}</span>
                    <span className="text-brand-600">
                      {f.fileName} · {formatBytes(f.sizeBytes)}
                      {f.asLink ? " · wird als Download-Link verschickt" : ""}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="text-xs text-brand-600">
              {attached.size - linkCount > 0
                ? `${attached.size - linkCount} Anhang (${formatBytes(attachedBytes)}). `
                : ""}
              {linkCount > 0 ? `${linkCount} Datei(en) als Download-Link. ` : ""}
              Weitere Dateien lädst du in der{" "}
              <Link href="/teacher/mediathek" className="font-medium text-azure-800 underline">
                Mediathek
              </Link>{" "}
              hoch.
            </p>
          </>
        )}
        {state.errors?.fileIds && <p className="text-sm text-red-700">{state.errors.fileIds}</p>}
      </fieldset>

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-md px-3 py-2 text-sm ${state.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}
        >
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || recipientCount === 0}
        className="rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Wird gesendet …" : `An ${recipientCount} Teilnehmer senden`}
      </button>
    </form>
  );
}
