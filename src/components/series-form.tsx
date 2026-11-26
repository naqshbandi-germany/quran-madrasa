"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { de } from "react-day-picker/locale";
import "react-day-picker/style.css";

import { TimeField } from "@/components/date-time-fields";
import { WEEKDAY_LABELS, WEEKDAY_ORDER, WEEKDAY_SHORT } from "@/lib/course-labels";
import { saveSeries, type SeriesField, type SeriesFormState } from "@/lib/series-actions";

// Formular fuer eine Terminserie (Reiter Sitzungen und Termine > "Termin anlegen").
// - Eingaben bleiben bei Fehlern erhalten (kontrollierte Felder), Fehler stehen am Feld und
//   oben als Liste mit Sprung zum Feld; schon vor dem Absenden wird im Browser geprueft.
// - Wochentage als Schalter, Ende ergibt sich aus Beginn + Dauer (Schnellwahl).
// - Zeitraum in einem Kalender: erst ersten, dann letzten Tag anklicken. Die Tage, an denen
//   Stunden stattfinden, sind markiert; Schnellwahl fuer 4/8/12 Wochen oder bis Kursende.

export type SeriesDefaults = {
  id?: string;
  title: string;
  weekdays: string[];
  startTime: string;
  endTime: string;
  firstDate: string;
  lastDate: string;
  note: string;
};

export const EMPTY_SERIES: SeriesDefaults = {
  title: "",
  weekdays: [],
  startTime: "",
  endTime: "",
  firstDate: "",
  lastDate: "",
  note: "",
};

export type SeriesCourse = { id: string; title: string; started: boolean; endsOn: string | null };

type Field = SeriesField;
type Errors = Partial<Record<Field, string>>;

const INITIAL: SeriesFormState = {};
const FIELD_ORDER: Field[] = ["courseId", "title", "weekdays", "startTime", "endTime", "firstDate", "lastDate"];
const FIELD_LABELS: Record<Field, string> = {
  courseId: "Kurs",
  title: "Titel",
  weekdays: "Wochentage",
  startTime: "Beginn",
  endTime: "Ende",
  firstDate: "Zeitraum",
  lastDate: "Zeitraum",
  form: "Serie",
};
export const DURATIONS = [30, 45, 60, 90];
const JS_DAY: Record<string, number> = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };

const INPUT = "mt-1 w-full border bg-white px-3 py-2 focus:outline-none focus:ring-2";
export const inputClass = (invalid: boolean) =>
  `${INPUT} ${invalid ? "border-red-600 ring-red-600/30 focus:ring-red-600/40" : "border-brand-300 focus:ring-azure-700/30"}`;

// --- Datums-Helfer (Kalendertage ohne Uhrzeit, lokale Mitternacht) --------------------------

export function pad(n: number) {
  return String(n).padStart(2, "0");
}
export function toKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function fromKey(key: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}
function addDays(d: Date, days: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
}
export function today() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
export function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function timeOf(total: number) {
  const t = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(t / 60))}:${pad(t % 60)}`;
}

export const dayFormat = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
const shortFormat = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric", year: "numeric" });

function lessonDates(range: DateRange | undefined, weekdays: string[]) {
  if (!range?.from || !range.to || weekdays.length === 0) return [];
  const days = new Set(weekdays.map((d) => JS_DAY[d]));
  const result: Date[] = [];
  for (let d = range.from; d <= range.to && result.length < 400; d = addDays(d, 1)) {
    if (days.has(d.getDay())) result.push(d);
  }
  return result;
}

// Naechster Tag ab "from", an dem laut Wochentagen eine Stunde ist (fuer die Schnellwahl).
function nextLessonDay(from: Date, weekdays: string[]) {
  if (weekdays.length === 0) return from;
  const days = new Set(weekdays.map((d) => JS_DAY[d]));
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    if (days.has(d.getDay())) return d;
  }
  return from;
}

// Client-Pruefung mit denselben Regeln wie saveSeries (der Server prueft trotzdem).
function validate(values: {
  courseId: string;
  title: string;
  titleRequired: boolean;
  weekdays: string[];
  startTime: string;
  endTime: string;
  range: DateRange | undefined;
  datesRequired: boolean;
}): Errors {
  const e: Errors = {};
  if (!values.courseId) e.courseId = "Bitte einen Kurs wählen.";
  if (values.titleRequired && values.title.trim().length < 3) e.title = "Der Titel braucht mindestens 3 Zeichen.";
  if (values.weekdays.length === 0) e.weekdays = "Bitte mindestens einen Wochentag wählen.";
  if (!values.startTime) e.startTime = "Bitte eine Uhrzeit angeben.";
  if (!values.endTime) e.endTime = "Bitte eine Uhrzeit angeben.";
  else if (values.startTime && values.endTime <= values.startTime) e.endTime = "Das Ende muss nach dem Beginn liegen.";
  const { from, to } = values.range ?? {};
  if (from && !to) e.lastDate = "Bitte auch den letzten Tag im Kalender anklicken.";
  if (!from && values.datesRequired) e.firstDate = "Der Kurs läuft schon: Bitte den Zeitraum wählen.";
  return e;
}

export function SeriesForm({
  courseId,
  courses,
  started = false,
  courseEndsOn = null,
  defaults,
  submitLabel,
}: {
  courseId?: string;
  courses?: SeriesCourse[];
  started?: boolean;
  courseEndsOn?: string | null;
  defaults: SeriesDefaults;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(saveSeries, INITIAL);
  const [selectedCourse, setSelectedCourse] = useState(courseId ?? "");
  const [title, setTitle] = useState(defaults.title);
  const [weekdays, setWeekdays] = useState<string[]>(defaults.weekdays);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [range, setRange] = useState<DateRange | undefined>(() => {
    const from = fromKey(defaults.firstDate);
    return from ? { from, to: fromKey(defaults.lastDate) } : undefined;
  });
  const [note, setNote] = useState(defaults.note);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [clientErrors, setClientErrors] = useState<Errors>({});
  const [touchedSinceSubmit, setTouched] = useState<Set<Field>>(new Set());
  const summaryRef = useRef<HTMLDivElement>(null);

  const course = courses?.find((c) => c.id === selectedCourse);
  const datesRequired = courses ? Boolean(course?.started) : started;
  const endsOn = courses ? (course?.endsOn ?? null) : courseEndsOn;

  // Server-Fehler gelten, bis das Feld geaendert wird.
  const serverErrors: Errors = state.errors ?? {};
  const errors: Errors = { ...serverErrors, ...clientErrors };
  for (const field of touchedSinceSubmit) delete errors[field];
  const errorList = FIELD_ORDER.filter((f) => errors[f]).map((f) => [f, errors[f]!] as const);
  if (errors.form) errorList.unshift(["form", errors.form]);

  useEffect(() => {
    if (state.errors) summaryRef.current?.focus();
  }, [state]);

  const touch = (...fields: Field[]) => setTouched((prev) => new Set([...prev, ...fields]));

  const duration = startTime && endTime && endTime > startTime ? minutes(endTime) - minutes(startTime) : null;
  const dates = useMemo(() => lessonDates(range, weekdays), [range, weekdays]);

  function changeStart(value: string) {
    // Ende wandert mit, damit die Dauer gleich bleibt.
    if (value && duration) setEndTime(timeOf(minutes(value) + duration));
    else if (value && !endTime) setEndTime(timeOf(minutes(value) + 60));
    setStartTime(value);
    touch("startTime", "endTime");
  }

  function preset(weeks: number | "end") {
    const from = range?.from ?? nextLessonDay(today(), weekdays);
    const to = weeks === "end" ? fromKey(endsOn ?? "") : addDays(from, weeks * 7 - 1);
    if (!to || to < from) return;
    setRange({ from, to });
    touch("firstDate", "lastDate");
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const found = validate({
      courseId: selectedCourse,
      title,
      titleRequired: !courses,
      weekdays,
      startTime,
      endTime,
      range,
      datesRequired,
    });
    setClientErrors(found);
    setTouched(new Set());
    if (Object.keys(found).length > 0) {
      event.preventDefault();
      if (found.firstDate || found.lastDate) setCalendarOpen(true);
      requestAnimationFrame(() => summaryRef.current?.focus());
    }
  }

  const fieldError = (field: Field) =>
    errors[field] ? (
      <span id={`${field}-error`} className="mt-1 block text-sm text-red-700">
        {errors[field]}
      </span>
    ) : null;
  const aria = (field: Field) => ({
    "aria-invalid": errors[field] ? true : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
  });
  const periodError = errors.firstDate ?? errors.lastDate;
  const idPrefix = defaults.id ?? "neu";

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
                  <a href={`#${idPrefix}-${field === "lastDate" ? "firstDate" : field}`} className="underline">
                    {FIELD_LABELS[field]}: {message}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {defaults.id && <input type="hidden" name="seriesId" value={defaults.id} />}
      {courses ? (
        <label className="col-span-full flex flex-col text-brand-700">
          Kurs
          <select
            id={`${idPrefix}-courseId`}
            name="courseId"
            value={selectedCourse}
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              touch("courseId", "firstDate", "lastDate");
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
                {c.started ? " (läuft)" : ""}
              </option>
            ))}
          </select>
          {fieldError("courseId")}
        </label>
      ) : (
        <input type="hidden" name="courseId" value={selectedCourse} />
      )}

      <label className="col-span-full flex flex-col text-brand-700">
        Titel der Stunden{courses ? " (leer = Kurstitel)" : ""}
        <input
          id={`${idPrefix}-title`}
          name="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            touch("title");
          }}
          placeholder={course?.title}
          className={inputClass(Boolean(errors.title))}
          {...aria("title")}
        />
        {fieldError("title")}
      </label>

      <fieldset className="col-span-full" {...aria("weekdays")}>
        <legend className="text-brand-700">Wochentage</legend>
        <div
          id={`${idPrefix}-weekdays`}
          tabIndex={-1}
          className={`mt-1 flex flex-wrap gap-2 p-0.5 ${errors.weekdays ? "outline outline-2 outline-offset-2 outline-red-600" : ""}`}
        >
          {WEEKDAY_ORDER.map((day) => {
            const checked = weekdays.includes(day);
            return (
              <label
                key={day}
                className={`cursor-pointer select-none border px-3 py-1.5 font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-azure-700/40 ${
                  checked ? "border-azure-800 bg-azure-800 text-white" : "border-brand-300 bg-white text-brand-700 hover:border-azure-700"
                }`}
                title={WEEKDAY_LABELS[day]}
              >
                <input
                  type="checkbox"
                  name="weekdays"
                  value={day}
                  checked={checked}
                  onChange={() => {
                    setWeekdays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
                    touch("weekdays");
                  }}
                  className="sr-only"
                />
                <span aria-hidden="true">{WEEKDAY_SHORT[day]}</span>
                <span className="sr-only">{WEEKDAY_LABELS[day]}</span>
              </label>
            );
          })}
        </div>
        {fieldError("weekdays")}
      </fieldset>

      <div className="flex flex-col text-brand-700">
        <label htmlFor={`${idPrefix}-startTime`}>Beginn</label>
        <TimeField
          id={`${idPrefix}-startTime`}
          name="startTime"
          value={startTime}
          onChange={changeStart}
          invalid={Boolean(errors.startTime)}
          describedBy={errors.startTime ? "startTime-error" : undefined}
          suggestFrom="16:00"
        />
        {fieldError("startTime")}
      </div>
      <div className="flex flex-col text-brand-700">
        <label htmlFor={`${idPrefix}-endTime`}>Ende</label>
        <TimeField
          id={`${idPrefix}-endTime`}
          name="endTime"
          value={endTime}
          onChange={(value) => {
            setEndTime(value);
            touch("endTime");
          }}
          invalid={Boolean(errors.endTime)}
          describedBy={errors.endTime ? "endTime-error" : undefined}
          suggestFrom={startTime || "17:00"}
        />
        {fieldError("endTime")}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-brand-600">Dauer:</span>
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              disabled={!startTime}
              onClick={() => {
                setEndTime(timeOf(minutes(startTime) + d));
                touch("endTime");
              }}
              className={`border px-2 py-0.5 disabled:opacity-40 ${
                duration === d ? "border-azure-800 bg-azure-50 text-azure-800" : "border-brand-300 hover:border-azure-700"
              }`}
            >
              {d} Min.
            </button>
          ))}
        </div>
      </div>

      {/* Zeitraum */}
      <div className="col-span-full text-brand-700">
        <span id={`${idPrefix}-period-label`}>Zeitraum{datesRequired ? "" : " (optional, zum Starten des Kurses nötig)"}</span>
        <button
          id={`${idPrefix}-firstDate`}
          type="button"
          aria-expanded={calendarOpen}
          aria-labelledby={`${idPrefix}-period-label ${idPrefix}-firstDate`}
          onClick={() => setCalendarOpen((v) => !v)}
          className={`${inputClass(Boolean(periodError))} flex items-center justify-between text-left`}
          {...aria(errors.firstDate ? "firstDate" : "lastDate")}
        >
          <span className={range?.from ? "text-brand-900" : "text-brand-600"}>
            {range?.from
              ? `${dayFormat.format(range.from)} – ${range.to ? dayFormat.format(range.to) : "letzten Tag wählen"}`
              : "Ersten und letzten Tag wählen"}
          </span>
          <span aria-hidden="true">{calendarOpen ? "▲" : "▼"}</span>
        </button>
        {periodError && (
          <span id={errors.firstDate ? "firstDate-error" : "lastDate-error"} className="mt-1 block text-sm text-red-700">
            {periodError}
          </span>
        )}
        <input type="hidden" name="firstDate" value={range?.from ? toKey(range.from) : ""} />
        <input type="hidden" name="lastDate" value={range?.from && range.to ? toKey(range.to) : ""} />

        {range?.from && range.to && (
          <p className="mt-1.5 text-brand-700">
            {weekdays.length === 0 ? (
              "Wähle die Wochentage, dann siehst du hier die Zahl der Stunden."
            ) : dates.length === 0 ? (
              <span className="text-red-700">In diesem Zeitraum liegt kein gewählter Wochentag.</span>
            ) : (
              <>
                <strong>{dates.length} Stunden</strong>, erste am {dayFormat.format(dates[0])}, letzte am{" "}
                {dayFormat.format(dates[dates.length - 1])}
              </>
            )}
          </p>
        )}

        {calendarOpen && (
          <div className="series-calendar mt-2 border border-brand-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-brand-600">Schnellwahl{range?.from ? ` ab ${shortFormat.format(range.from)}` : ""}:</span>
              {[4, 8, 12].map((w) => (
                <button key={w} type="button" onClick={() => preset(w)} className="border border-brand-300 px-2 py-0.5 hover:border-azure-700">
                  {w} Wochen
                </button>
              ))}
              {endsOn && (
                <button type="button" onClick={() => preset("end")} className="border border-brand-300 px-2 py-0.5 hover:border-azure-700">
                  bis Kursende ({shortFormat.format(fromKey(endsOn)!)})
                </button>
              )}
              {range?.from && (
                <button
                  type="button"
                  onClick={() => {
                    setRange(undefined);
                    touch("firstDate", "lastDate");
                  }}
                  className="ml-auto text-brand-700 underline"
                >
                  Zurücksetzen
                </button>
              )}
            </div>
            <DayPicker
              mode="range"
              locale={de}
              weekStartsOn={1}
              numberOfMonths={2}
              defaultMonth={range?.from ?? today()}
              selected={range}
              onSelect={(next, clicked) => {
                // Nach einem fertigen Zeitraum beginnt ein neuer Klick wieder beim ersten Tag.
                if (range?.from && range.to) setRange({ from: clicked, to: undefined });
                else setRange(next);
                touch("firstDate", "lastDate");
              }}
              modifiers={{ lesson: dates }}
              modifiersClassNames={{ lesson: "series-lesson" }}
              footer={
                <p className="mt-2 text-xs text-brand-600">
                  {!range?.from
                    ? "Klicke den ersten Tag an."
                    : !range.to
                      ? "Jetzt den letzten Tag anklicken."
                      : "Markierte Tage: hier finden Stunden statt."}
                </p>
              }
            />
            <div className="mt-2 text-right">
              <button
                type="button"
                onClick={() => setCalendarOpen(false)}
                className="border border-azure-800 px-3 py-1 font-medium text-azure-800 hover:bg-azure-800 hover:text-white"
              >
                Fertig
              </button>
            </div>
          </div>
        )}
      </div>

      <label className="col-span-full flex flex-col text-brand-700">
        Hinweis im Stundenplan (optional, z. B. „Morgens“)
        <input name="note" value={note} onChange={(e) => setNote(e.target.value)} className={inputClass(false)} />
      </label>

      <div className="col-span-full flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary px-4 py-2 disabled:opacity-60">
          {pending ? "Wird gespeichert …" : submitLabel}
        </button>
      </div>
    </form>
  );
}
