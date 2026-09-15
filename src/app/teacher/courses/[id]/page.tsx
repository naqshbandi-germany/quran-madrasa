import { Weekday } from "@prisma/client";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClassSession, createScheduleSlot, deleteScheduleSlot } from "@/lib/teacher-actions";
import { WEEKDAY_LABELS } from "@/lib/course-labels";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function ManageCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: { startsAt: "asc" } },
      scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
    },
  });
  if (!course) notFound();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-700">{course.title}</h1>

      <section className="space-y-4">
        <h2 className="font-semibold text-brand-700">Wöchentlicher Stundenplan</h2>
        <p className="text-sm text-brand-600">
          Feste Wochentermine für das Kursangebot (z.B. &bdquo;Mittwoch 18:00–18:40&ldquo;) –
          unabhängig von den einzelnen Sitzungen mit Zoom-Link unten.
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
        <h2 className="font-semibold text-brand-700">Sitzungen (mit Zoom-Link)</h2>
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
                  Zoom-Link
                </a>
              ) : (
                "kein Link hinterlegt"
              )}
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-brand-200 bg-white p-5">
          <h3 className="mb-4 font-semibold text-brand-700">Neue Sitzung anlegen</h3>
          <form action={createClassSession} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="courseId" value={course.id} />
            <input
              name="title"
              placeholder="Titel (z.B. Sure Al-Baqara, Vers 1-10)"
              required
              className="col-span-full rounded-md border border-brand-200 px-3 py-2"
            />
            <input
              name="startsAt"
              type="datetime-local"
              required
              className="rounded-md border border-brand-200 px-3 py-2"
            />
            <input
              name="joinUrl"
              type="url"
              placeholder="Zoom-Link (https://zoom.us/j/...)"
              className="rounded-md border border-brand-200 px-3 py-2"
            />
            <button className="col-span-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
              Sitzung anlegen
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
