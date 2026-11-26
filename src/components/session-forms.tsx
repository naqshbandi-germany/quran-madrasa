import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/lib/course-labels";
import { saveSeries } from "@/lib/series-actions";
import { createClassSession } from "@/lib/teacher-actions";

// Formulare fuer Terminserie und einzelne Stunde. Im Reiter Sitzungen steht der Kurs fest
// (courseId), unter Termine > "Termin anlegen" wird er aus einer Liste gewaehlt (courses).

const INPUT = "border border-brand-300 px-3 py-2";
const SAVE_BUTTON = "btn-primary px-4 py-2";

type CourseChoice = { courseId: string } | { courses: { id: string; title: string }[] };

function CourseField(props: CourseChoice) {
  if ("courseId" in props) return <input type="hidden" name="courseId" value={props.courseId} />;
  return (
    <label className="col-span-full flex flex-col text-brand-700">
      Kurs
      <select name="courseId" required defaultValue="" className={`mt-1 ${INPUT}`}>
        <option value="" disabled>
          Kurs wählen
        </option>
        {props.courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}

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

export function SeriesForm({
  defaults,
  datesRequired,
  submitLabel,
  ...course
}: CourseChoice & {
  defaults: SeriesDefaults;
  datesRequired: boolean;
  submitLabel: string;
}) {
  return (
    <form action={saveSeries} className="grid gap-3 text-sm sm:grid-cols-2">
      <CourseField {...course} />
      {defaults.id && <input type="hidden" name="seriesId" value={defaults.id} />}
      <label className="col-span-full flex flex-col text-brand-700">
        Titel der Stunden{"courses" in course ? " (leer = Kurstitel)" : ""}
        <input name="title" required={"courseId" in course} defaultValue={defaults.title} className={`mt-1 ${INPUT}`} />
      </label>
      <fieldset className="col-span-full">
        <legend className="text-brand-700">Wochentage</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
          {WEEKDAY_ORDER.map((day) => (
            <label key={day} className="inline-flex items-center gap-1.5">
              <input type="checkbox" name="weekdays" value={day} defaultChecked={defaults.weekdays.includes(day)} />
              {WEEKDAY_LABELS[day]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col text-brand-700">
        Beginn
        <input name="startTime" type="time" required defaultValue={defaults.startTime} className={`mt-1 ${INPUT}`} />
      </label>
      <label className="flex flex-col text-brand-700">
        Ende
        <input name="endTime" type="time" required defaultValue={defaults.endTime} className={`mt-1 ${INPUT}`} />
      </label>
      <label className="flex flex-col text-brand-700">
        Erster Tag{datesRequired ? "" : " (optional)"}
        <input name="firstDate" type="date" required={datesRequired} defaultValue={defaults.firstDate} className={`mt-1 ${INPUT}`} />
      </label>
      <label className="flex flex-col text-brand-700">
        Letzter Tag{datesRequired ? "" : " (optional)"}
        <input name="lastDate" type="date" required={datesRequired} defaultValue={defaults.lastDate} className={`mt-1 ${INPUT}`} />
      </label>
      <label className="col-span-full flex flex-col text-brand-700">
        Hinweis im Stundenplan (optional, z. B. „Morgens“)
        <input name="note" defaultValue={defaults.note} className={`mt-1 ${INPUT}`} />
      </label>
      <button className={`col-span-full ${SAVE_BUTTON}`}>{submitLabel}</button>
    </form>
  );
}

export function SingleSessionForm(course: CourseChoice) {
  return (
    <form action={createClassSession} className="grid gap-3 text-sm sm:grid-cols-2">
      <CourseField {...course} />
      <input name="title" placeholder="Titel (z. B. Ersatzstunde)" required className={`col-span-full ${INPUT}`} />
      <label className="flex flex-col text-brand-700">
        Beginn
        <input name="startsAt" type="datetime-local" required className={`mt-1 ${INPUT}`} />
      </label>
      <label className="flex flex-col text-brand-700">
        Dauer in Minuten
        <input name="durationMin" type="number" min={5} max={480} defaultValue={60} className={`mt-1 ${INPUT}`} />
      </label>
      <input
        name="joinUrl"
        type="url"
        placeholder="Eigener Link (optional, ersetzt die automatische Erzeugung)"
        className={`col-span-full ${INPUT}`}
      />
      <button className={`col-span-full ${SAVE_BUTTON}`}>Stunde anlegen</button>
    </form>
  );
}
