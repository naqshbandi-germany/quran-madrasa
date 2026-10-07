import { Weekday } from "@prisma/client";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import {
  createClassSession,
  createRecurringSessions,
  createScheduleSlot,
  deleteScheduleSlot,
  sendCourseMaterial,
} from "@/lib/teacher-actions";
import { isZoomProvider } from "@/lib/classroom";
import { WEEKDAY_LABELS } from "@/lib/course-labels";
import { formatGermanDateTime, formatTeachingDateTime } from "@/lib/schedule-time";

function formatDateTime(date: Date) {
  return `${formatTeachingDateTime(date)} Ortszeit (${formatGermanDateTime(date)} deutsche Zeit)`;
}

export default async function ManageCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: { startsAt: "asc" } },
      scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
      enrollments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!course) notFound();

  const zoom = isZoomProvider();
  const meetingKind = zoom ? "Zoom" : "Jitsi";
  const meetingDescription = zoom
    ? "ein Zoom-Meeting im Zoom-Konto des Lehrers"
    : "ein kostenloser Jitsi-Meeting-Link";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-700">{course.title}</h1>

      <section className="space-y-4">
        <h2 className="font-semibold text-brand-700">Wöchentlicher Stundenplan</h2>
        <p className="text-sm text-brand-600">
          Feste Wochentermine für das Kursangebot (z.B. &bdquo;Mittwoch 18:00–18:40&ldquo;) –
          unabhängig von den einzelnen Sitzungen mit Meeting-Link unten. Uhrzeiten bitte in
          Ortszeit Nordzypern (UTC+3) eintragen; auf der Website werden sie automatisch in
          deutsche Zeit umgerechnet.
        </p>

        <ul className="space-y-2">
          {course.scheduleSlots.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center justify-between rounded-md border border-brand-200 bg-white px-4 py-2 text-sm"
            >
              <span>
                {WEEKDAY_LABELS[slot.weekday] ?? slot.weekday}: {slot.startTime}–{slot.endTime}
                {slot.note ? ` (${slot.note})` : ""}
              </span>
              <form action={deleteScheduleSlot}>
                <input type="hidden" name="slotId" value={slot.id} />
                <input type="hidden" name="courseId" value={course.id} />
                <button className="text-brand-600 underline">entfernen</button>
              </form>
            </li>
          ))}
        </ul>

        <form action={createScheduleSlot} className="grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="courseId" value={course.id} />
          <select
            name="weekday"
            required
            className="rounded-md border border-brand-200 px-3 py-2"
            defaultValue=""
          >
            <option value="" disabled>
              Wochentag
            </option>
            {Object.values(Weekday).map((day) => (
              <option key={day} value={day}>
                {WEEKDAY_LABELS[day] ?? day}
              </option>
            ))}
          </select>
          <input
            name="startTime"
            type="time"
            required
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <input
            name="endTime"
            type="time"
            required
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <input
            name="note"
            placeholder="Hinweis (optional, z.B. Morgens)"
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <button className="col-span-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 sm:col-span-1">
            Termin hinzufügen
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-brand-700">Sitzungen (mit Meeting-Link)</h2>
        <ul className="space-y-2">
          {course.sessions.map((classSession) => (
            <li
              key={classSession.id}
              className="rounded-md border border-brand-200 bg-white px-4 py-3 text-sm"
            >
              <span className="font-medium">{classSession.title}</span> ·{" "}
              {formatDateTime(classSession.startsAt)} ·{" "}
              {classSession.joinUrl ? (
                <a href={classSession.joinUrl} className="underline">
                  {classSession.classroomType === "JITSI" ? "Jitsi-Link" : "Zoom-Link"}
                </a>
              ) : (
                "kein Link hinterlegt"
              )}
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-brand-200 bg-white p-5">
          <h3 className="mb-4 font-semibold text-brand-700">Einzelne Sitzung anlegen</h3>
          <p className="mb-3 text-sm text-brand-600">
            Ohne eigenen Link wird automatisch {meetingDescription} erzeugt. Beginn bitte in
            Ortszeit Nordzypern angeben.
          </p>
          <form action={createClassSession} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="courseId" value={course.id} />
            <input
              name="title"
              placeholder="Titel (z.B. Sure Al-Baqara, Vers 1-10)"
              required
              className="col-span-full rounded-md border border-brand-200 px-3 py-2"
            />
            <label className="flex flex-col text-sm text-brand-700">
              Beginn (Ortszeit Nordzypern)
              <input
                name="startsAt"
                type="datetime-local"
                required
                className="mt-1 rounded-md border border-brand-200 px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm text-brand-700">
              Dauer in Minuten
              <input
                name="durationMin"
                type="number"
                min={5}
                max={480}
                defaultValue={60}
                className="mt-1 rounded-md border border-brand-200 px-3 py-2"
              />
            </label>
            <input
              name="joinUrl"
              type="url"
              placeholder="Eigener Link (optional, ersetzt die automatische Erzeugung)"
              className="col-span-full rounded-md border border-brand-200 px-3 py-2"
            />
            <button className="col-span-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
              Sitzung anlegen
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-brand-200 bg-white p-5">
          <h3 className="mb-1 font-semibold text-brand-700">Wiederkehrende Sitzungen anlegen</h3>
          <p className="mb-3 text-sm text-brand-600">
            Legt mehrere Termine auf einmal an, jeweils mit eigenem, automatisch erzeugtem
            Meeting-Link ({meetingKind}). Datum und Uhrzeit in Ortszeit Nordzypern.
          </p>
          <form action={createRecurringSessions} className="grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="courseId" value={course.id} />
            <input
              name="title"
              placeholder="Titel (für alle Termine)"
              required
              className="col-span-full rounded-md border border-brand-200 px-3 py-2"
            />
            <select
              name="weekday"
              required
              defaultValue=""
              className="rounded-md border border-brand-200 px-3 py-2"
            >
              <option value="" disabled>
                Wochentag
              </option>
              {Object.values(Weekday).map((day) => (
                <option key={day} value={day}>
                  {WEEKDAY_LABELS[day] ?? day}
                </option>
              ))}
            </select>
            <input
              name="startTime"
              type="time"
              required
              className="rounded-md border border-brand-200 px-3 py-2"
            />
            <input
              name="endTime"
              type="time"
              required
              className="rounded-md border border-brand-200 px-3 py-2"
            />
            <label className="flex flex-col text-sm text-brand-700">
              Erster Termin
              <input
                name="firstDate"
                type="date"
                required
                className="mt-1 rounded-md border border-brand-200 px-3 py-2"
              />
            </label>
            <label className="flex flex-col text-sm text-brand-700">
              Intervall
              <select
                name="interval"
                defaultValue="WEEKLY"
                className="mt-1 rounded-md border border-brand-200 px-3 py-2"
              >
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
                className="mt-1 rounded-md border border-brand-200 px-3 py-2"
              />
            </label>
            <button className="col-span-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
              Termine anlegen
            </button>
          </form>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-brand-700">Kursmaterial per E-Mail verschicken</h2>
        <p className="text-sm text-brand-600">
          Schickt eine Nachricht (z.B. Lernmaterial, Hausaufgaben, Ankündigungen) an alle
          eingeschriebenen Teilnehmer dieses Kurses – getrennt von den automatischen
          Sitzungs-Erinnerungen.
        </p>

        {course.enrollments.length === 0 ? (
          <p className="text-sm text-brand-600">Noch keine Teilnehmer eingeschrieben.</p>
        ) : (
          <div className="rounded-lg border border-brand-200 bg-white p-5">
            <p className="mb-4 text-sm text-brand-600">
              Empfänger: {course.enrollments.map((e) => e.user.name).join(", ")} (
              {course.enrollments.length} Teilnehmer)
            </p>
            <form action={sendCourseMaterial} className="space-y-3">
              <input type="hidden" name="courseId" value={course.id} />
              <input
                name="subject"
                placeholder="Betreff"
                required
                className="w-full rounded-md border border-brand-200 px-3 py-2"
              />
              <textarea
                name="message"
                placeholder="Nachricht an die Teilnehmer…"
                required
                rows={6}
                className="w-full rounded-md border border-brand-200 px-3 py-2"
              />
              <button className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
                An {course.enrollments.length} Teilnehmer senden
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}
