import { Weekday } from "@prisma/client";
import Link from "next/link";

import { RemoveForm } from "../remove-form";
import { EditableRow } from "@/components/editable-row";
import { TimeZoneNotice } from "@/components/time-zone-notice";
import { isZoomProvider } from "@/lib/classroom";
import { WEEKDAY_LABELS } from "@/lib/course-labels";
import { requireManagedCourse } from "@/lib/course-manage";
import { prisma } from "@/lib/prisma";
import { convertSlotZone, formatGermanDateTime, formatZonedDateTime, toZonedInputValue } from "@/lib/schedule-time";
import {
  createClassSession,
  createRecurringSessions,
  createScheduleSlot,
  deleteClassSession,
  deleteScheduleSlot,
  updateClassSession,
  updateScheduleSlot,
} from "@/lib/teacher-actions";
import { teacherTimeZone, timeZoneLabel } from "@/lib/time-zones";
import { resolveViewTimeZone } from "@/lib/view-time-zone";

const INPUT = "border border-brand-300 px-3 py-2";
const SAVE_BUTTON = "btn-primary px-4 py-2";

// In der angezeigten Zeitzone; ausserhalb deutscher Zeit zusaetzlich die deutsche Zeit.
function formatDateTime(date: Date, timeZone: string) {
  if (timeZone === "Europe/Berlin") return `${formatGermanDateTime(date)} Uhr`;
  return `${formatZonedDateTime(date, timeZone)} Uhr (${formatGermanDateTime(date)} deutsche Zeit)`;
}

type SessionData = {
  id: string;
  title: string;
  startsAt: Date;
  durationMin: number;
  joinUrl: string | null;
  classroomType: string;
  lessonContent: string | null;
  _count: { evaluations: number };
};

// Aendert sich ein Wert, wird die Zeile neu aufgebaut und das Bearbeiten-Formular klappt zu.
function sessionKey(s: SessionData) {
  return `${s.id}-${s.startsAt.getTime()}-${s.title}-${s.durationMin}-${s.joinUrl ?? ""}`;
}

function SessionRow({
  classSession,
  courseId,
  isUpcoming,
  timeZone,
}: {
  classSession: SessionData;
  courseId: string;
  isUpcoming: boolean;
  timeZone: string;
}) {
  const linkLabel = classSession.classroomType === "JITSI" ? "Jitsi-Link" : "Zoom-Link";
  return (
    <EditableRow
      summary={
        <div>
          <p className="font-medium">{classSession.title}</p>
          <p className="text-brand-600">
            {formatDateTime(classSession.startsAt, timeZone)} · {classSession.durationMin} Min. ·{" "}
            {classSession.joinUrl ? (
              <a href={classSession.joinUrl} className="underline">
                {linkLabel}
              </a>
            ) : (
              "kein Link hinterlegt"
            )}
          </p>
          <p className="mt-1">
            <Link
              href={`/teacher/courses/${courseId}/sitzungen/${classSession.id}`}
              className="font-medium text-azure-800 underline"
            >
              {isUpcoming ? "Inhalt & Hausaufgabe" : "Stunde auswerten"}
            </Link>
            {(classSession._count.evaluations > 0 || classSession.lessonContent) && (
              <span className="ml-2 text-xs text-brand-600">
                ✓ ausgewertet
                {classSession._count.evaluations > 0 ? ` (${classSession._count.evaluations} Teilnehmer)` : ""}
              </span>
            )}
          </p>
        </div>
      }
      removeAction={
        <RemoveForm
          action={deleteClassSession}
          fields={{ sessionId: classSession.id }}
          message="Diese Sitzung wirklich entfernen? Ein automatisch erzeugtes Zoom-Meeting und die Auswertung der Stunde (Anwesenheit, Lernstand) werden dabei ebenfalls gelöscht."
        />
      }
    >
      <form action={updateClassSession} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="sessionId" value={classSession.id} />
        <input type="hidden" name="courseId" value={courseId} />
        <input
          name="title"
          required
          defaultValue={classSession.title}
          aria-label="Titel"
          className={`col-span-full ${INPUT}`}
        />
        <label className="flex flex-col text-brand-700">
          Beginn
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={toZonedInputValue(classSession.startsAt, timeZone)}
            className={`mt-1 ${INPUT}`}
          />
        </label>
        <label className="flex flex-col text-brand-700">
          Dauer in Minuten
          <input
            name="durationMin"
            type="number"
            min={5}
            max={480}
            required
            defaultValue={classSession.durationMin}
            className={`mt-1 ${INPUT}`}
          />
        </label>
        <label className="col-span-full flex flex-col text-brand-700">
          Link (ändern ersetzt den automatisch erzeugten)
          <input name="joinUrl" type="url" defaultValue={classSession.joinUrl ?? ""} className={`mt-1 ${INPUT}`} />
        </label>
        <p className="col-span-full text-xs text-brand-600">
          Wird der Beginn verschoben, passen wir ein automatisch erzeugtes Zoom-Meeting an und
          verschicken die Erinnerungen neu.
        </p>
        <button className={`col-span-full ${SAVE_BUTTON}`}>Speichern</button>
      </form>
    </EditableRow>
  );
}

function WeekdaySelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <select name="weekday" required defaultValue={defaultValue ?? ""} className={INPUT}>
      {!defaultValue && (
        <option value="" disabled>
          Wochentag
        </option>
      )}
      {Object.values(Weekday).map((day) => (
        <option key={day} value={day}>
          {WEEKDAY_LABELS[day] ?? day}
        </option>
      ))}
    </select>
  );
}

// Reiter "Sitzungen": Sitzungen mit Meeting-Link (anlegen, bearbeiten, auswerten), der
// woechentliche Stundenplan fuer die Website und die Leseproben.
export default async function CourseSessionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { session, course } = await requireManagedCourse(id);
  const { timeZone: viewTimeZone, ownTimeZone, showingOwn } = await resolveViewTimeZone(session.user.id);

  const [sessions, scheduleSlots, teacher, unheardSamples] = await Promise.all([
    prisma.classSession.findMany({
      where: { courseId: id },
      orderBy: { startsAt: "asc" },
      include: { _count: { select: { evaluations: true } } },
    }),
    prisma.scheduleSlot.findMany({ where: { courseId: id }, orderBy: [{ weekday: "asc" }, { startTime: "asc" }] }),
    prisma.user.findUnique({ where: { id: course.teacherId }, select: { timeZone: true } }),
    prisma.readingSample.count({ where: { courseId: id, listenedAt: null } }),
  ]);
  // Stundenplan-Eintraege gelten immer in der Zeitzone der Lehrkraft des Kurses.
  const courseTimeZone = teacherTimeZone(teacher ?? { timeZone: null });
  // Der Stundenplan ist in der Ortszeit der Lehrkraft gespeichert und wird wie die Sitzungen in
  // der angezeigten Zeitzone gezeigt und bearbeitet (Umrechnung beim Speichern).
  const slots = scheduleSlots.map((slot) => convertSlotZone(slot, courseTimeZone, viewTimeZone));

  const now = new Date();
  const upcomingSessions = sessions.filter((s) => s.startsAt >= now);
  const pastSessions = sessions.filter((s) => s.startsAt < now).reverse();

  const zoom = isZoomProvider();
  const meetingKind = zoom ? "Zoom" : "Jitsi";
  // Hinweis zur Zeitzone nur, wenn nicht ohnehin deutsche Zeit gilt (Lehrkraft mit eigener Zeitzone).
  const zoneHint = viewTimeZone === "Europe/Berlin" ? "" : ` Datum und Uhrzeit in ${timeZoneLabel(viewTimeZone)}.`;
  const meetingDescription = zoom ? "ein Zoom-Meeting im Zoom-Konto des Lehrers" : "ein kostenloser Jitsi-Meeting-Link";

  return (
    <div className="space-y-8">
      <TimeZoneNotice timeZone={viewTimeZone} ownTimeZone={ownTimeZone} showingOwn={showingOwn} />

      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-azure-800">Sitzungen (mit Meeting-Link)</h2>
          <Link href={`/teacher/courses/${course.id}/leseproben`} className="text-sm font-medium text-azure-800 underline">
            Leseproben{unheardSamples > 0 ? ` (${unheardSamples} neu)` : ""}
          </Link>
        </div>
        {upcomingSessions.length === 0 && <p className="text-sm text-brand-600">Keine kommenden Sitzungen geplant.</p>}
        <ul className="space-y-2">
          {upcomingSessions.map((s) => (
            <SessionRow key={sessionKey(s)} classSession={s} courseId={course.id} isUpcoming timeZone={viewTimeZone} />
          ))}
        </ul>
        {pastSessions.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-brand-700">
              Vergangene Sitzungen ({pastSessions.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {pastSessions.map((s) => (
                <SessionRow
                  key={sessionKey(s)}
                  classSession={s}
                  courseId={course.id}
                  isUpcoming={false}
                  timeZone={viewTimeZone}
                />
              ))}
            </ul>
          </details>
        )}

        <div className="border border-gold-400/40 bg-white p-5">
          <h3 className="mb-4 font-semibold text-azure-800">Einzelne Sitzung anlegen</h3>
          <p className="mb-3 text-sm text-brand-600">
            Ohne eigenen Link wird automatisch {meetingDescription} erzeugt. {zoneHint}
          </p>
          <form action={createClassSession} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="courseId" value={course.id} />
            <input
              name="title"
              placeholder="Titel (z.B. Sure Al-Baqara, Vers 1-10)"
              required
              className={`col-span-full ${INPUT}`}
            />
            <label className="flex flex-col text-sm text-brand-700">
              Beginn
              <input name="startsAt" type="datetime-local" required className={`mt-1 ${INPUT}`} />
            </label>
            <label className="flex flex-col text-sm text-brand-700">
              Dauer in Minuten
              <input name="durationMin" type="number" min={5} max={480} defaultValue={60} className={`mt-1 ${INPUT}`} />
            </label>
            <input
              name="joinUrl"
              type="url"
              placeholder="Eigener Link (optional, ersetzt die automatische Erzeugung)"
              className={`col-span-full ${INPUT}`}
            />
            <button className={`col-span-full ${SAVE_BUTTON}`}>Sitzung anlegen</button>
          </form>
        </div>

        <div className="border border-gold-400/40 bg-white p-5">
          <h3 className="mb-1 font-semibold text-azure-800">Wiederkehrende Sitzungen anlegen</h3>
          <p className="mb-3 text-sm text-brand-600">
            Legt mehrere Termine auf einmal an, jeweils mit eigenem, automatisch erzeugtem Meeting-Link (
            {meetingKind}).{zoneHint}
          </p>
          <form action={createRecurringSessions} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="courseId" value={course.id} />
            <input name="title" placeholder="Titel (für alle Termine)" required className={`col-span-full ${INPUT}`} />
            <WeekdaySelect />
            <input name="startTime" type="time" required className={INPUT} />
            <input name="endTime" type="time" required className={INPUT} />
            <label className="flex flex-col text-sm text-brand-700">
              Erster Termin
              <input name="firstDate" type="date" required className={`mt-1 ${INPUT}`} />
            </label>
            <label className="flex flex-col text-sm text-brand-700">
              Intervall
              <select name="interval" defaultValue="WEEKLY" className={`mt-1 ${INPUT}`}>
                <option value="WEEKLY">Wöchentlich</option>
                <option value="BIWEEKLY">Alle 2 Wochen</option>
                <option value="MONTHLY">Monatlich</option>
              </select>
            </label>
            <label className="flex flex-col text-sm text-brand-700">
              Anzahl Termine
              <input
                name="occurrences"
                type="number"
                min={1}
                max={52}
                defaultValue={12}
                required
                className={`mt-1 ${INPUT}`}
              />
            </label>
            <button className={`col-span-full ${SAVE_BUTTON}`}>Termine anlegen</button>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-azure-800">Wöchentlicher Stundenplan</h2>
        <p className="text-sm text-brand-600">
          Feste Wochentermine für das Kursangebot (z.B. &bdquo;Mittwoch 18:00–18:40&ldquo;) – unabhängig von den
          einzelnen Sitzungen mit Meeting-Link oben.
          {zoneHint && `${zoneHint.replace("Datum und Uhrzeit", "Uhrzeiten")} Auf der Website erscheinen sie in deutscher Zeit.`}
        </p>

        <ul className="space-y-2">
          {slots.map((slot) => (
            <EditableRow
              key={`${slot.id}-${slot.weekday}-${slot.startTime}-${slot.endTime}-${slot.note ?? ""}`}
              summary={
                <span className="font-medium">
                  {WEEKDAY_LABELS[slot.weekday] ?? slot.weekday}: {slot.startTime}–{slot.endTime}
                  {slot.note ? <span className="font-normal text-brand-600"> ({slot.note})</span> : ""}
                </span>
              }
              removeAction={
                <RemoveForm
                  action={deleteScheduleSlot}
                  fields={{ slotId: slot.id, courseId: course.id }}
                  message="Diesen Wochentermin wirklich entfernen?"
                />
              }
            >
              <form action={updateScheduleSlot} className="grid gap-3 sm:grid-cols-4">
                <input type="hidden" name="slotId" value={slot.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <WeekdaySelect defaultValue={slot.weekday} />
                <input name="startTime" type="time" required defaultValue={slot.startTime} className={INPUT} />
                <input name="endTime" type="time" required defaultValue={slot.endTime} className={INPUT} />
                <input name="note" placeholder="Hinweis (optional)" defaultValue={slot.note ?? ""} className={INPUT} />
                <button className={`col-span-full sm:col-span-1 ${SAVE_BUTTON}`}>Speichern</button>
              </form>
            </EditableRow>
          ))}
        </ul>

        <form action={createScheduleSlot} className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="courseId" value={course.id} />
          <WeekdaySelect />
          <input name="startTime" type="time" required className={INPUT} />
          <input name="endTime" type="time" required className={INPUT} />
          <input name="note" placeholder="Hinweis (optional, z.B. Morgens)" className={INPUT} />
          <button className={`col-span-full sm:col-span-1 ${SAVE_BUTTON}`}>Termin hinzufügen</button>
        </form>
      </section>
    </div>
  );
}
