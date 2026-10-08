"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { FileIcon, XIcon } from "@/components/icons";
import { MediaBrowser } from "@/components/media-browser";
import { UploadForm } from "@/components/media-upload-form";
import type { ActionResult } from "@/lib/account-actions";
import { sendCourseEmail } from "@/lib/email-actions";
import { formatBytes } from "@/lib/media";
import type { MediaItem } from "@/lib/media-items";

export type ComposerCourse = {
  id: string;
  title: string;
  participants: { id: string; name: string; detail: string }[];
};

// Angaben fuer den Datei-Upload im Auswahlfenster (siehe UploadForm)
export type ComposerUpload = { blobEnabled: boolean; blobAccess: "public" | "private"; userId: string };

const INITIAL: ActionResult = { ok: false };
const INPUT = "w-full rounded-md border border-brand-300 bg-white px-3 py-2";

// Auswahlfenster ("Pop-up") mit der Mediathek: Dateien anhaken, bei Bedarf eine neue hochladen.
// Wird per Portal an das Seitenende gehaengt, weil der Upload ein eigenes Formular ist und nicht
// im E-Mail-Formular stehen darf.
function MediaPicker({
  files,
  upload,
  attached,
  onToggle,
  onClose,
}: {
  files: MediaItem[];
  upload: ComposerUpload;
  attached: Set<string>;
  onToggle: (id: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-label="Mediathek"
      className="m-auto h-[min(46rem,92vh)] w-[min(64rem,96vw)] rounded-lg border border-brand-200 bg-white p-0 shadow-xl backdrop:bg-black/60"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-brand-100 px-5 py-3">
          <h2 className="text-lg font-semibold text-brand-900">Mediathek: Dateien für die E-Mail auswählen</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fenster schließen"
            className="rounded-md p-1.5 text-brand-700 hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-azure-700"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <details className="rounded-lg border border-brand-200 bg-brand-50">
            <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-azure-800">
              Neue Datei hochladen
            </summary>
            <div className="px-4 pb-4">
              <UploadForm {...upload} />
            </div>
          </details>
          <MediaBrowser items={files} mode="select" selected={attached} onToggle={onToggle} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-brand-100 px-5 py-3">
          <p className="text-sm text-brand-700" aria-live="polite">
            {attached.size === 0 ? "Noch keine Datei ausgewählt" : `${attached.size} Datei(en) ausgewählt`}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-brand-600 px-5 py-2 font-medium text-white hover:bg-brand-700"
          >
            Fertig
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

// E-Mail an Kursteilnehmer: Kurs waehlen (oder fest vorgegeben), an alle oder einzelne
// Teilnehmer, Betreff und Text, Dateien aus der Mediathek als Anhang (Auswahl im Pop-up).
export function EmailComposer({
  courses,
  files,
  upload,
  initialCourseId,
}: {
  courses: ComposerCourse[];
  files: MediaItem[];
  upload: ComposerUpload;
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
  const [pickerOpen, setPickerOpen] = useState(false);
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
  const attachedFiles = files.filter((f) => attached.has(f.id));
  const attachedBytes = attachedFiles.filter((f) => !f.asLink).reduce((sum, f) => sum + f.sizeBytes, 0);
  const linkCount = attachedFiles.filter((f) => f.asLink).length;

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
      <div className="space-y-2">
        <p className="text-sm font-medium text-brand-700">Anhänge aus der Mediathek</p>
        {attachedFiles.length > 0 && (
          <ul className="space-y-1.5">
            {attachedFiles.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-brand-200 bg-brand-50 px-3 py-2 text-sm"
              >
                <input type="hidden" name="fileIds" value={f.id} />
                <FileIcon className="h-4 w-4 shrink-0 text-brand-600" />
                <span className="font-medium">{f.title}</span>
                <span className="text-brand-600">
                  {f.fileName} · {formatBytes(f.sizeBytes)}
                  {f.asLink ? " · wird als Download-Link verschickt" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => setAttached((current) => toggle(current, f.id))}
                  aria-label={`${f.title} entfernen`}
                  className="ml-auto inline-flex items-center gap-1 text-red-800 hover:text-red-700"
                >
                  <XIcon className="h-4 w-4" />
                  Entfernen
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-md border border-azure-800 px-4 py-2 text-sm font-medium text-azure-800 transition hover:bg-azure-800 hover:text-white"
          >
            {attachedFiles.length > 0 ? "Auswahl ändern …" : "Aus der Mediathek wählen …"}
          </button>
          {attachedFiles.length > 0 && (
            <span className="text-xs text-brand-600">
              {attachedFiles.length - linkCount > 0 ? `Anhänge: ${formatBytes(attachedBytes)}. ` : ""}
              {linkCount > 0 ? `${linkCount} Datei(en) als Download-Link.` : ""}
            </span>
          )}
        </div>
        {state.errors?.fileIds && <p className="text-sm text-red-700">{state.errors.fileIds}</p>}
      </div>

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

      {pickerOpen && (
        <MediaPicker
          files={files}
          upload={upload}
          attached={attached}
          onToggle={(id) => setAttached((current) => toggle(current, id))}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </form>
  );
}
