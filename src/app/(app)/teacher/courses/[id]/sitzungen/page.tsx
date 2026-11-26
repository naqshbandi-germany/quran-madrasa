import Link from "next/link";

import { RemoveForm } from "../remove-form";
import { ConfirmButton } from "@/components/confirm-button";
import { CourseStatusBadge } from "@/components/course-status-badge";
import { EditableRow } from "@/components/editable-row";
import { TimeZoneNotice } from "@/components/time-zone-notice";
import { isZoomProvider } from "@/lib/classroom";
import { WEEKDAY_LABELS, WEEKDAY_ORDER } from "@/lib/course-labels";
import { requireManagedCourse } from "@/lib/course-manage";
import { prisma } from "@/lib/prisma";
import { formatGermanDateTime, formatZonedDateTime, toZonedInputValue } from "@/lib/schedule-time";
import { convertSeriesZone, dateKey, formatSeriesPeriod, formatSeriesTimes, seriesOccurrences } from "@/lib/series";
import { endSeries, saveSeries, startCourse } from "@/lib/series-actions";
import { cancelClassSession, createClassSession, deleteClassSession, updateClassSession } from "@/lib/teacher-actions";
import { teacherTimeZone, timeZoneLabel } from "@/lib/time-zones";
import { resolveViewTimeZone } from "@/lib/view-time-zone";

const INPUT = "border border-brand-300 px-3 py-2";
const SAVE_BUTTON = "btn-primary px-4 py-2";
const BOX = "border border-gold-400/40 bg-white p-5";

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
  seriesId: string | null;
  isException: boolean;
  cancelledAt: Date | null;
  _count: { evaluations: number };
};

// Aendert sich ein Wert, wird die Zeile neu aufgebaut und das Bearbeiten-Formular klappt zu.
function sessionKey(s: SessionData) {
  return `${s.id}-${s.startsAt.getTime()}-${s.title}-${s.durationMin}-${s.joinUrl ?? ""}-${s.cancelledAt?.getTime() ?? ""}`;
}

function SessionSummary({ s, courseId, isUpcoming, timeZone }: { s: SessionData; courseId: string; isUpcoming: boolean; timeZone: string }) {
  const linkLabel = s.classroomType === "JITSI" ? "Jitsi-Link" : "Zoom-Link";
  return (
    <div>
      <p className="font-medium">
        {s.title}
        {s.seriesId && s.isException && !s.cancelledAt && (
          <span className="ml-2 text-xs font-normal text-brand-600">einzeln geändert</span>
        )}
        {!s.seriesId && <span className="ml-2 text-xs font-normal text-brand-600">Einzeltermin</span>}
      </p>
      <p className="text-brand-600">
        {formatDateTime(s.startsAt, timeZone)} · {s.durationMin} Min. ·{" "}
        {s.joinUrl ? (
          <a href={s.joinUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {linkLabel}
          </a>
        ) : (
          "kein Link hinterlegt"
        )}
      </p>
      <p className="mt-1">
        <Link href={`/teacher/courses/${courseId}/sitzungen/${s.id}`} className="font-medium text-azure-800 underline">
          {isUpcoming ? "Inhalt & Hausaufgabe" : "Stunde auswerten"}
        </Link>
        {(s._count.evaluations > 0 || s.lessonContent) && (
          <span className="ml-2 text-xs text-brand-600">
            ✓ ausgewertet
            {s._count.evaluations > 0 ? ` (${s._count.evaluations} Teilnehmer)` : ""}
          </span>
        )}
      </p>
    </div>
  );
}

function SessionRow({
  classSession: s,
  courseId,
  isUpcoming,
  timeZone,
}: {
  classSession: SessionData;
  courseId: string;
  isUpcoming: boolean;
  timeZone: string;
}) {
  // Abgesagte Stunde: durchgestrichen, ohne Bearbeiten. Einzeltermine lassen sich ganz entfernen.
  if (s.cancelledAt) {
    return (
      <li className="flex flex-wrap items-center gap-x-5 gap-y-2 border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-600">
        <div>
          <p className="font-medium line-through">{s.title}</p>
          <p>
            <span className="line-through">{formatDateTime(s.startsAt, timeZone)}</span> · abgesagt
          </p>
        </div>
        {!s.seriesId && (
          <RemoveForm
            action={deleteClassSession}
            fields={{ sessionId: s.id }}
            message="Diese abgesagte Stunde ganz aus der Liste entfernen?"
          />
        )}
      </li>
    );
  }

  return (
    <EditableRow
      summary={<SessionSummary s={s} courseId={courseId} isUpcoming={isUpcoming} timeZone={timeZone} />}
      removeAction={
        isUpcoming ? (
          <RemoveForm
            action={cancelClassSession}
            fields={{ sessionId: s.id }}
            label="Absagen"
            message="Diese Stunde absagen? Die Teilnehmer bekommen eine E-Mail, das Zoom-Meeting wird gelöscht."
          />
        ) : (
          <RemoveForm
            action={deleteClassSession}
            fields={{ sessionId: s.id }}
            message="Diese vergangene Stunde wirklich entfernen? Die Auswertung (Anwesenheit, Lernstand) wird dabei ebenfalls gelöscht."
          />
        )
      }
    >
      <form action={updateClassSession} className="grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="sessionId" value={s.id} />
        <input name="title" required defaultValue={s.title} aria-label="Titel" className={`col-span-full ${INPUT}`} />
        <label className="flex flex-col text-brand-700">
          Beginn
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={toZonedInputValue(s.startsAt, timeZone)}
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
            defaultValue={s.durationMin}
            className={`mt-1 ${INPUT}`}
          />
        </label>
        <label className="col-span-full flex flex-col text-brand-700">
          Eigener Link (ersetzt den automatisch erzeugten)
          <input name="joinUrl" type="url" defaultValue={s.joinUrl ?? ""} className={`mt-1 ${INPUT}`} />
        </label>
        <p className="col-span-full text-xs text-brand-600">
          Ändert nur diese eine Stunde{s.seriesId ? " (Ausnahme von der Serie)" : ""}. Wird sie verschoben, passen wir das
          Zoom-Meeting an, informieren die Teilnehmer und verschicken die Erinnerungen neu.
        </p>
        <button className={`col-span-full ${SAVE_BUTTON}`}>Speichern</button>
      </form>
    </EditableRow>
  );
}

type SeriesDefaults = {
  id?: string;
  title: string;
  weekdays: string[];
  startTime: string;
  endTime: string;
  firstDate: string;
  lastDate: string;
  note: string;
};

function SeriesForm({
  courseId,
  defaults,
  datesRequired,
  submitLabel,
}: {
  courseId: string;
  defaults: SeriesDefaults;
  datesRequired: boolean;
  submitLabel: string;
}) {
  return (
    <form action={saveSeries} className="grid gap-3 text-sm sm:grid-cols-2">
      <input type="hidden" name="courseId" value={courseId} />
      {defaults.id && <input type="hidden" name="seriesId" value={defaults.id} />}
      <label className="col-span-full flex flex-col text-brand-700">
        Titel der Stunden
        <input name="title" required defaultValue={defaults.title} className={`mt-1 ${INPUT}`} />
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
        <input
          name="firstDate"
          type="date"
          required={datesRequired}
          defaultValue={defaults.firstDate}
          className={`mt-1 ${INPUT}`}
        />
      </label>
      <label className="flex flex-col text-brand-700">
        Letzter Tag{datesRequired ? "" : " (optional)"}
        <input
          name="lastDate"
          type="date"
          required={datesRequired}
          defaultValue={defaults.lastDate}
          className={`mt-1 ${INPUT}`}
        />
      </label>
      <label className="col-span-full flex flex-col text-brand-700">
        Hinweis im Stundenplan (optional, z. B. „Morgens“)
        <input name="note" defaultValue={defaults.note} className={`mt-1 ${INPUT}`} />
      </label>
      <button className={`col-span-full ${SAVE_BUTTON}`}>{submitLabel}</button>
    </form>
  );
}

function dateInput(date: Date | null) {
  return date ? dateKey(date) : "";
}

// Reiter "Sitzungen": Kursstatus mit "Kurs starten", die Terminserien (daraus entstehen
// Stundenplan und Stunden) und die einzelnen Stunden mit Meeting-Link.
export default async function CourseSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hinweis?: string; fehler?: string }>;
}) {
  const { id } = await params;
  const { hinweis, fehler } = await searchParams;
  const { session, course } = await requireManagedCourse(id);
  const { timeZone: viewTimeZone, ownTimeZone, showingOwn } = await resolveViewTimeZone(session.user.id);

  const [sessions, seriesList, teacher, unheardReading, unheardInvited] = await Promise.all([
    prisma.classSession.findMany({
      where: { courseId: id },
      orderBy: { startsAt: "asc" },
      include: { _count: { select: { evaluations: true } } },
    }),
    prisma.sessionSeries.findMany({ where: { courseId: id }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] }),
    prisma.user.findUnique({ where: { id: course.teacherId }, select: { timeZone: true } }),
    prisma.readingSample.count({ where: { courseId: id, listenedAt: null } }),
    // Hoerproben zu Einladungen (noch nicht angemeldet)
    prisma.trialSample.count({ where: { invitation: { courseId: id }, listenedAt: null } }),
  ]);
  const unheardSamples = unheardReading + unheardInvited;
  // Serien gelten in der Ortszeit der Lehrkraft des Kurses.
  const courseTimeZone = teacherTimeZone(teacher ?? { timeZone: null });

  const now = new Date();
  const upcomingSessions = sessions.filter((s) => s.startsAt >= now);
  const pastSessions = sessions.filter((s) => s.startsAt < now).reverse();
  const upcomingBySeries = new Map<string, number>();
  for (const s of upcomingSessions) {
    if (s.seriesId && !s.cancelledAt) upcomingBySeries.set(s.seriesId, (upcomingBySeries.get(s.seriesId) ?? 0) + 1);
  }
  // Vor dem Start: wie viele Stunden "Kurs starten" anlegen wuerde.
  const plannedCount = seriesList.reduce(
    (sum, s) => sum + seriesOccurrences(s, courseTimeZone).filter((o) => o.startsAt > now).length,
    0,
  );
  const undated = seriesList.filter((s) => !s.firstDate || !s.lastDate);
  // Serien sind in der Ortszeit der Lehrkraft gespeichert, angezeigt und bearbeitet werden sie
  // (wie die Stunden) in der angezeigten Zeitzone.
  const shownSeries = seriesList.map((s) => convertSeriesZone(s, courseTimeZone, viewTimeZone));

  const zoom = isZoomProvider();
  const zoneHint = viewTimeZone === "Europe/Berlin" ? "" : ` Datum und Uhrzeit in ${timeZoneLabel(viewTimeZone)}.`;
  const meetingDescription = zoom ? "ein Zoom-Meeting im Zoom-Konto der Lehrkraft" : "ein Jitsi-Link";
  const started = Boolean(course.startedAt);

  return (
    <div className="space-y-8">
      {fehler && (
        <p role="alert" className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {fehler}
        </p>
      )}
      {hinweis && (
        <p role="status" className="border border-green-700/30 bg-green-50 px-4 py-3 text-sm text-green-900">
          {hinweis}
        </p>
      )}
      <TimeZoneNotice timeZone={viewTimeZone} ownTimeZone={ownTimeZone} showingOwn={showingOwn} />

      {/* Kursstatus */}
      <section className={`${BOX} space-y-3`}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-semibold text-azure-800">Kursstatus</h2>
          <CourseStatusBadge course={course} />
        </div>
        {started ? (
          <p className="text-sm text-brand-700">
            Der Kurs läuft seit {new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium" }).format(course.startedAt!)}. Neue oder geänderte
            Serien wirken sich sofort auf die kommenden Stunden aus.
          </p>
        ) : (
          <>
            <p className="text-sm text-brand-700">
              Die Serien stehen schon im Stundenplan{course.isPublished ? "" : " (sobald der Kurs veröffentlicht ist)"}.
              Stunden mit Zoom-Link und Erinnerungen entstehen erst, wenn du den Kurs startest, z. B. sobald genug
              Teilnehmer angemeldet sind. Veröffentlichen oder auf Entwurf setzen kannst du unter{" "}
              <Link href={`/teacher/courses/${course.id}/einstellungen`} className="underline">
                Einstellungen
              </Link>
              .
            </p>
            {seriesList.length === 0 ? (
              <p className="text-sm text-brand-600">Lege zuerst unten eine Terminserie an.</p>
            ) : undated.length > 0 ? (
              <p className="text-sm text-brand-600">
                Zum Starten braucht jede Serie einen ersten und letzten Tag.
              </p>
            ) : (
              <form action={startCourse}>
                <input type="hidden" name="courseId" value={course.id} />
                <ConfirmButton
                  message={`Kurs jetzt starten? Es werden ${plannedCount} Stunden mit ${zoom ? "Zoom" : "Meeting"}-Links angelegt, die Teilnehmer werden vor jeder Stunde erinnert.`}
                  className={SAVE_BUTTON}
                >
                  Kurs starten ({plannedCount} Stunden anlegen)
                </ConfirmButton>
              </form>
            )}
          </>
        )}
      </section>

      {/* Terminserien */}
      <section className="space-y-4">
        <div>
          <h2 className="font-semibold text-azure-800">Terminserien</h2>
          <p className="text-sm text-brand-600">
            Eine Serie sind die festen Kurszeiten, z. B. Montag und Mittwoch 18:00–19:00. Daraus entsteht der Stundenplan
            auf der Website und, sobald der Kurs läuft, jede einzelne Stunde mit eigenem {zoom ? "Zoom" : "Meeting"}-Link.
            Änderungen an der Serie gelten für alle kommenden Stunden, einzeln geänderte oder abgesagte Stunden bleiben,
            wie sie sind.{zoneHint.replace("Datum und Uhrzeit", "Uhrzeiten")}
          </p>
        </div>
        {shownSeries.length > 0 && (
          <ul className="space-y-2">
            {shownSeries.map((s) => {
              const period = formatSeriesPeriod(s);
              const upcoming = upcomingBySeries.get(s.id) ?? 0;
              return (
                <EditableRow
                  key={`${s.id}-${s.title}-${s.weekdays.join()}-${s.startTime}-${s.endTime}-${period}-${s.note ?? ""}`}
                  summary={
                    <div>
                      <p className="font-medium">{s.title}</p>
                      <p className="text-brand-600">
                        {formatSeriesTimes(s)} · {period ?? "Zeitraum noch offen"}
                        {started && ` · ${upcoming} kommende ${upcoming === 1 ? "Stunde" : "Stunden"}`}
                        {s.note && ` · ${s.note}`}
                      </p>
                    </div>
                  }
                  removeAction={
                    <RemoveForm
                      action={endSeries}
                      fields={{ courseId: course.id, seriesId: s.id }}
                      label={upcoming > 0 ? "Beenden" : "Entfernen"}
                      message={
                        upcoming > 0
                          ? `Serie „${s.title}“ beenden? Die ${upcoming} kommenden Stunden und ihre Zoom-Meetings werden gelöscht, die Teilnehmer bekommen eine E-Mail. Vergangene Stunden bleiben.`
                          : `Serie „${s.title}“ entfernen? Sie verschwindet auch aus dem Stundenplan.`
                      }
                    />
                  }
                >
                  <SeriesForm
                    courseId={course.id}
                    datesRequired={started}
                    submitLabel={started ? "Für alle kommenden Stunden speichern" : "Speichern"}
                    defaults={{
                      id: s.id,
                      title: s.title,
                      weekdays: s.weekdays,
                      startTime: s.startTime,
                      endTime: s.endTime,
                      firstDate: dateInput(s.firstDate),
                      lastDate: dateInput(s.lastDate),
                      note: s.note ?? "",
                    }}
                  />
                </EditableRow>
              );
            })}
          </ul>
        )}
        <details className={BOX} open={seriesList.length === 0}>
          <summary className="cursor-pointer font-semibold text-azure-800">Neue Terminserie</summary>
          <div className="mt-4">
            <SeriesForm
              courseId={course.id}
              datesRequired={started}
              submitLabel="Serie anlegen"
              defaults={{
                title: course.title,
                weekdays: [],
                startTime: "",
                endTime: "",
                firstDate: dateInput(course.startsOn),
                lastDate: dateInput(course.endsOn),
                note: "",
              }}
            />
          </div>
        </details>
      </section>

      {/* Stunden */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-azure-800">Stunden</h2>
          <Link href={`/teacher/courses/${course.id}/leseproben`} className="text-sm font-medium text-azure-800 underline">
            Leseproben{unheardSamples > 0 ? ` (${unheardSamples} neu)` : ""}
          </Link>
        </div>
        {upcomingSessions.length === 0 && (
          <p className="text-sm text-brand-600">
            {started ? "Keine kommenden Stunden." : "Noch keine Stunden: Sie entstehen beim Start des Kurses."}
          </p>
        )}
        <ul className="space-y-2">
          {upcomingSessions.map((s) => (
            <SessionRow key={sessionKey(s)} classSession={s} courseId={course.id} isUpcoming timeZone={viewTimeZone} />
          ))}
        </ul>
        {pastSessions.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-brand-700">
              Vergangene Stunden ({pastSessions.length})
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

        <details className={BOX}>
          <summary className="cursor-pointer font-semibold text-azure-800">Einzelne Stunde anlegen</summary>
          <p className="mb-3 mt-2 text-sm text-brand-600">
            Für Zusatz- oder Ersatztermine außerhalb einer Serie. Ohne eigenen Link wird automatisch {meetingDescription}{" "}
            erzeugt.{zoneHint}
          </p>
          <form action={createClassSession} className="grid gap-3 text-sm sm:grid-cols-2">
            <input type="hidden" name="courseId" value={course.id} />
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
        </details>
      </section>
    </div>
  );
}

