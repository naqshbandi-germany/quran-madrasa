"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { de } from "react-day-picker/locale";
import "react-day-picker/style.css";

// Einheitliche Datums- und Uhrzeitfelder fuer den Lehrer- und Admin-Bereich (statt der
// Browser-Felder, die je nach Browser anders aussehen):
// - DateField: Knopf mit dem Datum, darunter ein Kalender (deutsch, Woche ab Montag) mit
//   "Heute" und "Leeren". Der Wert geht als verstecktes Feld "JJJJ-MM-TT" mit.
// - TimeField: Eingabefeld mit Vorschlagsliste im 15-Minuten-Takt. Tippen geht auch frei:
//   "18", "1830", "18.30" oder "18:30" werden zu 18:30.
// - DateTimeField: beides zusammen, Wert "JJJJ-MM-TTTHH:MM" (wie datetime-local).

const BASE = "mt-1 w-full border bg-white px-3 py-2 focus:outline-none focus:ring-2";
export const fieldClass = (invalid?: boolean) =>
  `${BASE} ${invalid ? "border-red-600 ring-red-600/30 focus:ring-red-600/40" : "border-brand-300 focus:ring-azure-700/30"}`;

function pad(n: number) {
  return String(n).padStart(2, "0");
}
export function dateToKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function keyToDate(key: string | null | undefined) {
  const m = key ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(key) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined;
}
function startOfToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

// Kurz und eindeutig, passt auch in schmale Spalten: "Mo., 30.11.2026".
const longDate = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });

// Schliesst ein aufgeklapptes Feld bei Klick ausserhalb oder Escape.
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

// --- Datum ------------------------------------------------------------------------------------

export function DateField({
  name,
  value: controlled,
  defaultValue = "",
  onChange,
  id,
  invalid,
  describedBy,
  placeholder = "Datum wählen",
  notBefore,
  clearable = true,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  notBefore?: "today";
  clearable?: boolean;
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const close = useMemo(() => () => setOpen(false), []);
  useDismiss(open, close, wrapper);
  const selected = keyToDate(value);

  function set(next: string) {
    if (controlled === undefined) setOwn(next);
    onChange?.(next);
  }

  return (
    <div ref={wrapper} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        onClick={() => setOpen((v) => !v)}
        className={`${fieldClass(invalid)} flex items-center justify-between gap-2 text-left`}
      >
        <span className={`whitespace-nowrap ${selected ? "text-brand-900" : "text-brand-600"}`}>
          {selected ? longDate.format(selected) : placeholder}
        </span>
        <CalendarIcon />
      </button>
      {name && <input type="hidden" name={name} value={value} />}
      {open && (
        <div
          role="dialog"
          aria-label="Datum wählen"
          className="series-calendar absolute left-0 z-30 mt-1 max-w-[calc(100vw-2rem)] border border-brand-200 bg-white p-3 shadow-lg"
        >
          <DayPicker
            mode="single"
            locale={de}
            weekStartsOn={1}
            showOutsideDays
            captionLayout="dropdown"
            startMonth={new Date(2024, 0)}
            endMonth={new Date(startOfToday().getFullYear() + 3, 11)}
            autoFocus
            defaultMonth={selected ?? startOfToday()}
            disabled={notBefore === "today" ? { before: startOfToday() } : undefined}
            selected={selected}
            onSelect={(d) => {
              if (d) {
                set(dateToKey(d));
                setOpen(false);
              }
            }}
          />
          <div className="mt-2 flex justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => {
                set(dateToKey(startOfToday()));
                setOpen(false);
              }}
              className="font-medium text-azure-800 underline"
            >
              Heute
            </button>
            {clearable && value && (
              <button
                type="button"
                onClick={() => {
                  set("");
                  setOpen(false);
                }}
                className="text-brand-700 underline"
              >
                Leeren
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-brand-600" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

// --- Uhrzeit ----------------------------------------------------------------------------------

// Freie Eingabe in "HH:MM" umwandeln; leer bei Unsinn.
export function parseTime(input: string) {
  const s = input.trim().replace(/\s*uhr$/i, "");
  if (!s) return "";
  let h: number;
  let m: number;
  const sep = /^(\d{1,2})[:.,h ](\d{1,2})$/.exec(s);
  if (sep) {
    h = Number(sep[1]);
    m = Number(sep[2].length === 1 ? `${sep[2]}0` : sep[2]);
  } else if (/^\d{1,2}$/.test(s)) {
    h = Number(s);
    m = 0;
  } else if (/^\d{3,4}$/.test(s)) {
    h = Number(s.slice(0, s.length - 2));
    m = Number(s.slice(-2));
  } else return "";
  if (h > 23 || m > 59) return "";
  return `${pad(h)}:${pad(m)}`;
}

const SLOTS = Array.from({ length: 96 }, (_, i) => `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`);

export function TimeField({
  name,
  value: controlled,
  defaultValue = "",
  onChange,
  id,
  invalid,
  describedBy,
  suggestFrom = "08:00",
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  id?: string;
  invalid?: boolean;
  describedBy?: string;
  // Wohin die Liste beim Oeffnen scrollt, wenn noch keine Zeit gewaehlt ist.
  suggestFrom?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const [text, setText] = useState(value);
  const [shownValue, setShownValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapper = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const close = useMemo(() => () => setOpen(false), []);
  useDismiss(open, close, wrapper);

  // Aendert sich der Wert von aussen (z. B. Ende = Beginn + Dauer), Text nachziehen.
  if (value !== shownValue) {
    setShownValue(value);
    setText(value);
  }

  function commit(next: string) {
    setText(next);
    setShownValue(next);
    if (controlled === undefined) setOwn(next);
    onChange?.(next);
  }

  function openList() {
    setOpen(true);
    const target = value || suggestFrom;
    const index = SLOTS.findIndex((slot) => slot >= target);
    setActive(index);
    requestAnimationFrame(() => {
      const item = list.current?.children[Math.max(index, 0)] as HTMLElement | undefined;
      if (item && list.current) list.current.scrollTop = item.offsetTop - list.current.clientHeight / 2 + item.clientHeight / 2;
    });
  }

  function move(delta: number) {
    const next = Math.min(SLOTS.length - 1, Math.max(0, active + delta));
    setActive(next);
    setText(SLOTS[next]);
    const item = list.current?.children[next] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }

  return (
    <div ref={wrapper} className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder="--:--"
          value={text}
          onFocus={openList}
          onClick={() => !open && openList()}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = parseTime(e.target.value);
            if (parsed) {
              const index = SLOTS.findIndex((slot) => slot >= parsed);
              setActive(index);
              const item = list.current?.children[Math.max(index, 0)] as HTMLElement | undefined;
              item?.scrollIntoView({ block: "nearest" });
            }
          }}
          onBlur={() => {
            const parsed = parseTime(text);
            commit(parsed || (text.trim() ? value : ""));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (!open) openList();
              else move(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (!open) openList();
              else move(-1);
            } else if (e.key === "Enter") {
              if (open) {
                e.preventDefault();
                commit(parseTime(text) || SLOTS[active] || value);
                setOpen(false);
              }
            } else if (e.key === "Tab") {
              setOpen(false);
            }
          }}
          className={`${fieldClass(invalid)} pr-9 tabular-nums`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2">
          <ClockIcon />
        </span>
      </div>
      {name && <input type="hidden" name={name} value={value} />}
      {open && (
        <ul
          ref={list}
          id={listId}
          role="listbox"
          aria-label="Uhrzeit"
          className="absolute left-0 z-30 mt-1 max-h-56 w-full min-w-[8rem] overflow-y-auto border border-brand-200 bg-white py-1 shadow-lg"
        >
          {SLOTS.map((slot, i) => (
            <li
              key={slot}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={slot === value}
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                commit(slot);
                setOpen(false);
              }}
              className={`cursor-pointer px-3 py-1.5 tabular-nums ${
                slot === value
                  ? "bg-azure-800 text-white"
                  : i === active
                    ? "bg-azure-50 text-azure-800"
                    : "hover:bg-brand-50"
              }`}
            >
              {slot}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Datum und Uhrzeit -------------------------------------------------------------------------

export function DateTimeField({
  name,
  value: controlled,
  defaultValue = "",
  onChange,
  idPrefix,
  invalid,
  describedBy,
  notBefore,
}: {
  name: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  idPrefix?: string;
  invalid?: boolean;
  describedBy?: string;
  notBefore?: "today";
}) {
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const [date, time] = value.includes("T") ? value.split("T") : [value, ""];
  const [draft, setDraft] = useState({ date, time });
  // Halbe Eingaben (nur Datum) merken, der Wert entsteht erst mit beidem.
  const shown = value ? { date, time } : draft;

  function update(next: { date: string; time: string }) {
    setDraft(next);
    const combined = next.date && next.time ? `${next.date}T${next.time}` : "";
    if (controlled === undefined) setOwn(combined);
    onChange?.(combined);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-2">
      <DateField
        id={idPrefix ? `${idPrefix}-date` : undefined}
        value={shown.date}
        onChange={(d) => update({ ...shown, date: d })}
        invalid={invalid && !shown.date}
        describedBy={describedBy}
        notBefore={notBefore}
        clearable={false}
      />
      <TimeField
        id={idPrefix ? `${idPrefix}-time` : undefined}
        value={shown.time}
        onChange={(t) => update({ ...shown, time: t })}
        invalid={invalid && !shown.time}
        describedBy={describedBy}
        suggestFrom="17:00"
      />
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
