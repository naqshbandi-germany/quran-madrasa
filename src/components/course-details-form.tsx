"use client";

import { useActionState } from "react";

import { DateField } from "@/components/date-time-fields";
import type { ActionResult } from "@/lib/account-actions";
import { AGE_GROUP_LABELS } from "@/lib/course-labels";
import { updateCourseDetails } from "@/lib/course-manage-actions";

const INPUT = "mt-1 w-full border border-brand-300 bg-white px-3 py-2";
const INITIAL: ActionResult = { ok: false };

export type CourseDetails = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  ageGroups: string[];
  maxParticipants: string;
  startsOn: string;
  endsOn: string;
};

// Kursdaten in der Kursverwaltung (Reiter "Einstellungen"), fuer Lehrkraefte und Admins.
export function CourseDetailsForm({ course }: { course: CourseDetails }) {
  const [state, action, pending] = useActionState(updateCourseDetails, INITIAL);
  const error = (key: string) =>
    state.errors?.[key] ? <span className="mt-1 block text-sm text-red-700">{state.errors[key]}</span> : null;

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="courseId" value={course.id} />
      <label className="text-sm font-medium text-brand-700 sm:col-span-2">
        Name des Kurses
        <input name="title" required defaultValue={course.title} className={`${INPUT} text-base`} />
        {error("title")}
      </label>
      <label className="text-sm font-medium text-brand-700">
        Kategorie
        <input name="category" required defaultValue={course.category} className={INPUT} />
        {error("category")}
      </label>
      <label className="text-sm font-medium text-brand-700">
        Level (optional)
        <input name="level" defaultValue={course.level} placeholder="z. B. Level 1" className={INPUT} />
      </label>
      <div className="text-sm font-medium text-brand-700">
        <label htmlFor="kurs-startsOn">Laufzeit von</label>
        <DateField id="kurs-startsOn" name="startsOn" defaultValue={course.startsOn} invalid={Boolean(state.errors?.startsOn)} />
        {error("startsOn")}
      </div>
      <div className="text-sm font-medium text-brand-700">
        <label htmlFor="kurs-endsOn">Laufzeit bis</label>
        <DateField id="kurs-endsOn" name="endsOn" defaultValue={course.endsOn} invalid={Boolean(state.errors?.endsOn)} />
        {error("endsOn")}
      </div>
      <label className="text-sm font-medium text-brand-700">
        Höchstzahl Teilnehmer
        <input
          name="maxParticipants"
          type="number"
          min={1}
          max={500}
          defaultValue={course.maxParticipants}
          placeholder="unbegrenzt"
          className={INPUT}
        />
        <span className="mt-1 block text-xs font-normal text-brand-600">
          Leer = unbegrenzt. Ist die Grenze erreicht, erscheint der Kurs als „ausgebucht“ und Interessenten
          tragen sich in die Warteliste ein.
        </span>
        {error("maxParticipants")}
      </label>
      <fieldset className="text-sm text-brand-700">
        <legend className="font-medium">Altersgruppe</legend>
        <div className="mt-2 flex flex-wrap gap-4">
          {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5">
              <input type="checkbox" name="ageGroups" value={value} defaultChecked={course.ageGroups.includes(value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm font-medium text-brand-700 sm:col-span-2">
        Beschreibung
        <textarea name="description" required rows={6} defaultValue={course.description} className={INPUT} />
        {error("description")}
      </label>

      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`px-3 py-2 text-sm sm:col-span-2 ${state.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}
        >
          {state.message}
        </p>
      )}
      <button disabled={pending} className="btn-primary px-5 py-2.5 disabled:opacity-60 sm:col-span-2 sm:w-fit">
        {pending ? "Wird gespeichert …" : "Kursdaten speichern"}
      </button>
    </form>
  );
}
