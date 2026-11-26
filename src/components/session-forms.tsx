"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { de } from "react-day-picker/locale";

import { dayFormat, DURATIONS, inputClass, minutes, timeOf, today, toKey } from "@/components/series-form";
import { createClassSession, type SessionField, type SessionFormState } from "@/lib/teacher-actions";

// Formular fuer eine einzelne Stunde (die Terminserie steht in series-form.tsx). Im Reiter
// Sitzungen steht der Kurs fest (courseId), unter Termine > "Termin anlegen" wird er aus einer
// Liste gewaehlt (courses). Wie bei der Serie: Eingaben bleiben bei Fehlern erhalten, Fehler
// stehen am Feld, das Datum kommt aus einem Kalender.

const INITIAL: SessionFormState = {};
const FIELD_ORDER: SessionField[] = ["courseId", "title", "startsAt", "durationMin", "joinUrl"];
const FIELD_LABELS: Record<SessionField, string> = {
  courseId: "Kurs",
  title: "Titel",
  startsAt: "Datum und Beginn",
  durationMin: "Dauer",
  joinUrl: "Eigener Link",
  form: "Stunde",
};

export function SingleSessionForm({
  courseId,
  courses,
}: {
  courseId?: string;
  courses?: { id: string; title: string }[];
}) {
  const [state, action, pending] = useActionState(createClassSession, INITIAL);
  const [selectedCourse, setSelectedCourse] = useState(courseId ?? "");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [joinUrl, setJoinUrl] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [clientErrors, setClientErrors] = useState<SessionFormState["errors"]>({});
  const [touched, setTouched] = useState<Set<SessionField>>(new Set());
  const summaryRef = useRef<HTMLDivElement>(null);
  const prefix = `stunde-${courseId ?? "neu"}`;

  const errors = { ...(state.errors ?? {}), ...clientErrors };
  for (const field of touched) delete errors[field];
  const errorList = FIELD_ORDER.filter((f) => errors[f]).map((f) => [f, errors[f]!] as const);
  if (errors.form) errorList.unshift(["form", errors.form]);

  useEffect(() => {
    if (state.errors) summaryRef.current?.focus();
  }, [state]);

  const touch = (field: SessionField) => setTouched((prev) => new Set([...prev, field]));
  const startsAt = date && time ? `${toKey(date)}T${time}` : "";
  const durationNumber = Number(duration);
  const endLabel = time && durationNumber > 0 ? timeOf(minutes(time) + durationNumber) : null;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const found: SessionFormState["errors"] = {};
    if (!selectedCourse) found.courseId = "Bitte einen Kurs wählen.";
    if (title.trim().length < 3) found.title = "Der Titel braucht mindestens 3 Zeichen.";
    if (!date || !time) found.startsAt = date ? "Bitte die Uhrzeit angeben." : "Bitte ein Datum im Kalender wählen.";
    if (!Number.isInteger(durationNumber) || durationNumber < 5 || durationNumber > 480) {
      found.durationMin = "Bitte eine Dauer zwischen 5 und 480 Minuten angeben.";
    }
    if (joinUrl && !/^https?:\/\/\S+$/.test(joinUrl)) found.joinUrl = "Der Link muss mit https:// beginnen.";
    setClientErrors(found);
    setTouched(new Set());
    if (Object.keys(found).length > 0) {
      event.preventDefault();
      if (found.startsAt && !date) setCalendarOpen(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  const aria = (field: SessionField) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${prefix}-${field}-error` : undefined,
  });
  const fieldError = (field: SessionField) =>
    errors[field] ? (
      <span id={`${prefix}-${field}-error`} className="mt-1 block text-sm text-red-700">
        {errors[field]}
      </span>
    ) : null;

  return (
    <form action={action} onSubmit={onSubmit} noValidate className="grid gap-4 text-sm sm:grid-cols-2">
      {errorList.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="col-span-full border border-red-300 bg-red-50 px-4 py-3 text-red-900 focus:outline-none"
        >
          <p className="font-medium">Bitte prüfe {errorList.length === 1 ? "diese Angabe" : "diese Angaben"}:</p>
          <ul className="mt-1 list-disc pl-5">
            {errorList.map(([field, message]) => (
              <li key={field}>
                {field === "form" ? (
                  message
                ) : (
                  <a href={`#${prefix}-${field}`} className="underline">
                    {FIELD_LABELS[field]}: {message}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {courses ? (
        <label className="col-span-full flex flex-col text-brand-700">
          Kurs
          <select
            id={`${prefix}-courseId`}
            name="courseId"
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              touch("courseId");
            }}
            className={inputClass(Boolean(errors.courseId))}
            {...aria("courseId")}
          >
            <option value="" disabled>
              Kurs wählen
            </option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {fieldError("courseId")}
        </label>
      ) : (
        <input type="hidden" name="courseId" value={selectedCourse} />
      )}

      <label className="col-span-full flex flex-col text-brand-700">
        Titel
        <input
          id={`${prefix}-title`}
          name="title"
          value={title}
          placeholder="z. B. Ersatzstunde"
          onChange={(e) => {
            setTitle(e.target.value);
            touch("title");
          }}
          className={inputClass(Boolean(errors.title))}
          {...aria("title")}
        />
        {fieldError("title")}
      </label>

      <div className="flex flex-col text-brand-700">
        <span id={`${prefix}-date-label`}>Datum</span>
        <button
          id={`${prefix}-startsAt`}
          type="button"
          aria-expanded={calendarOpen}
          aria-labelledby={`${prefix}-date-label ${prefix}-startsAt`}
          onClick={() => setCalendarOpen((v) => !v)}
          className={`${inputClass(Boolean(errors.startsAt) && !date)} flex items-center justify-between text-left`}
          {...aria("startsAt")}
        >
          <span className={date ? "text-brand-900" : "text-brand-600"}>{date ? dayFormat.format(date) : "Datum wählen"}</span>
          <span aria-hidden="true">{calendarOpen ? "▲" : "▼"}</span>
        </button>
      </div>
      <label className="flex flex-col text-brand-700">
        Beginn
        <input
          type="time"
          step={300}
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            touch("startsAt");
          }}
          className={inputClass(Boolean(errors.startsAt) && !time)}
        />
      </label>
      <input type="hidden" name="startsAt" value={startsAt} />
      {errors.startsAt && <div className="col-span-full -mt-2">{fieldError("startsAt")}</div>}

      {calendarOpen && (
        <div className="series-calendar col-span-full border border-brand-200 bg-white p-3">
          <DayPicker
            mode="single"
            locale={de}
            weekStartsOn={1}
            showOutsideDays
            defaultMonth={date ?? today()}
            disabled={{ before: today() }}
            selected={date}
            onSelect={(next) => {
              setDate(next);
              touch("startsAt");
              if (next) setCalendarOpen(false);
            }}
          />
        </div>
      )}

      <div className="col-span-full flex flex-col text-brand-700">
        <label htmlFor={`${prefix}-durationMin`}>Dauer in Minuten</label>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <input
            id={`${prefix}-durationMin`}
            name="durationMin"
            type="number"
            min={5}
            max={480}
            value={duration}
            onChange={(e) => {
              setDuration(e.target.value);
              touch("durationMin");
            }}
            className={`${inputClass(Boolean(errors.durationMin))} !mt-0 !w-28`}
            {...aria("durationMin")}
          />
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDuration(String(d));
                touch("durationMin");
              }}
              className={`border px-2 py-0.5 text-xs ${
                duration === String(d) ? "border-azure-800 bg-azure-50 text-azure-800" : "border-brand-300 hover:border-azure-700"
              }`}
            >
              {d} Min.
            </button>
          ))}
          {endLabel && <span className="text-xs text-brand-600">bis {endLabel} Uhr</span>}
        </div>
        {fieldError("durationMin")}
      </div>

      <label className="col-span-full flex flex-col text-brand-700">
        Eigener Link (optional, sonst wird automatisch ein Zoom-Meeting angelegt)
        <input
          id={`${prefix}-joinUrl`}
          name="joinUrl"
          type="url"
          inputMode="url"
          value={joinUrl}
          placeholder="https://…"
          onChange={(e) => {
            setJoinUrl(e.target.value.trim());
            touch("joinUrl");
          }}
          // "zoom.us/j/123" wird beim Verlassen des Feldes zu "https://zoom.us/j/123".
          onBlur={() => {
            if (joinUrl && !/^https?:\/\//i.test(joinUrl) && /^[\w-]+(\.[\w-]+)+(\/|$)/.test(joinUrl)) {
              setJoinUrl(`https://${joinUrl}`);
            }
          }}
          className={inputClass(Boolean(errors.joinUrl))}
          {...aria("joinUrl")}
        />
        {fieldError("joinUrl")}
      </label>

      <div className="col-span-full">
        <button disabled={pending} className="btn-primary px-4 py-2 disabled:opacity-60">
          {pending ? "Wird angelegt …" : "Stunde anlegen"}
        </button>
      </div>
    </form>
  );
}
