import { Weekday } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ConfirmButton } from "@/components/confirm-button";
import { EmailComposer } from "@/components/email-composer";
import { CopyButton } from "@/components/copy-button";
import { EditableRow } from "@/components/editable-row";
import { TrashIcon } from "@/components/icons";
import {
  createClassSession,
  createRecurringSessions,
  createScheduleSlot,
  deleteClassSession,
  deleteScheduleSlot,
  updateClassSession,
  updateScheduleSlot,
} from "@/lib/teacher-actions";
import { isZoomProvider } from "@/lib/classroom";
import { blobAccess, isBlobConfigured } from "@/lib/blob";
import { toMediaItem } from "@/lib/media-items";
import { WEEKDAY_LABELS } from "@/lib/course-labels";
import { formatGermanDateTime, formatTeachingDateTime, toTeachingInputValue } from "@/lib/schedule-time";

const INPUT = "rounded-md border border-brand-200 px-3 py-2";
const SAVE_BUTTON = "rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700";

// Entfernen-Aktion mit Papierkorb-Symbol und Text, fragt vor dem Loeschen nach.
function RemoveForm({
  action,
  fields,
  message,
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  message: string;
}) {
  return (
    <form action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <ConfirmButton
        message={message}
        className="inline-flex items-center gap-1.5 rounded-md font-medium text-red-800 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
      >
        <TrashIcon />
        Entfernen
      </ConfirmButton>
    </form>
  );
}

function formatDateTime(date: Date) {
  return `${formatTeachingDateTime(date)} Ortszeit (${formatGermanDateTime(date)} deutsche Zeit)`;
}

type SessionData = {
  id: string;
  title: string;
  startsAt: Date;
  durationMin: number;
  joinUrl: string | null;
  classroomType: string;
};

// Aendert sich ein Wert, wird die Zeile neu aufgebaut und das Bearbeiten-Formular klappt zu.
function sessionKey(s: SessionData) {
  return `${s.id}-${s.startsAt.getTime()}-${s.title}-${s.durationMin}-${s.joinUrl ?? ""}`;
}

function SessionRow({ classSession, courseId }: { classSession: SessionData; courseId: string }) {
  const linkLabel = classSession.classroomType === "JITSI" ? "Jitsi-Link" : "Zoom-Link";
  return (
    <EditableRow
      summary={
        <div>
          <p className="font-medium">{classSession.title}</p>
          <p className="text-brand-600">
            {formatDateTime(classSession.startsAt)} · {classSession.durationMin} Min. ·{" "}
            {classSession.joinUrl ? (
              <a href={classSession.joinUrl} className="underline">
                {linkLabel}
              </a>
            ) : (
              "kein Link hinterlegt"
            )}
          </p>
        </div>
      }
      removeAction={
        <RemoveForm
          action={deleteClassSession}
          fields={{ sessionId: classSession.id }}
          message="Diese Sitzung wirklich entfernen? Ein automatisch erzeugtes Zoom-Meeting wird dabei ebenfalls gelöscht."
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
          Beginn (Ortszeit Nordzypern)
          <input
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={toTeachingInputValue(classSession.startsAt)}
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
          <input
            name="joinUrl"
            type="url"
            defaultValue={classSession.joinUrl ?? ""}
            className={`mt-1 ${INPUT}`}
          />
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

export default async function ManageCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      sessions: { orderBy: { startsAt: "asc" } },
      scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
      enrollments: {
        include: { participant: true, user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!course) notFound();

  // Lehrer sehen nur ihre eigenen Kurse (Teilnehmerdaten), Admins alle.
  const session = await auth();
  if (session?.user.role !== "ADMIN" && session?.user.id !== course.teacherId) notFound();

  // WhatsApp-Nummern nur mit Einwilligung, je Nummer einmal (Geschwister teilen oft die Nummer).
  const whatsappMembers: { id: string; name: string; whatsapp: string }[] = [];
  for (const { participant } of course.enrollments) {
    if (!participant.whatsapp || !participant.whatsappConsentAt) continue;
    const existing = whatsappMembers.find((m) => m.whatsapp === participant.whatsapp);
    if (existing) existing.name += `, ${participant.name}`;
    else whatsappMembers.push({ id: participant.id, name: participant.name, whatsapp: participant.whatsapp });
  }

  const mediaFiles = await prisma.mediaFile.findMany({
    where: session?.user.role === "ADMIN" ? {} : { ownerId: session?.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
      blobPathname: true,
    },
  });
  const composerFiles = mediaFiles.map((file) => toMediaItem(file));

  const now = new Date();
  const upcomingSessions = course.sessions.filter((s) => s.startsAt >= now);
  const pastSessions = course.sessions.filter((s) => s.startsAt < now).reverse();

  const zoom = isZoomProvider();
  const meetingKind = zoom ? "Zoom" : "Jitsi";
  const meetingDescription = zoom
    ? "ein Zoom-Meeting im Zoom-Konto des Lehrers"
    : "ein kostenloser Jitsi-Meeting-Link";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-700">{course.title}</h1>

      <section aria-labelledby="teilnehmer" className="space-y-4">
        <h2 id="teilnehmer" className="font-semibold text-brand-700">
          Teilnehmer ({course.enrollments.length})
        </h2>
        {course.enrollments.length === 0 ? (
          <p className="text-sm text-brand-600">Noch keine Teilnehmer eingeschrieben.</p>
        ) : (
          <ul className="divide-y divide-brand-100 rounded-lg border border-brand-200 bg-white text-sm">
            {course.enrollments.map(({ id, participant, user, createdAt }) => (
              <li key={id} className="px-4 py-3">
                <p className="font-medium text-brand-900">
                  {participant.name}{" "}
                  {participant.relation === "CHILD" && (
                    <span className="font-normal text-brand-600">
                      (Kind{participant.birthYear ? `, Jahrgang ${participant.birthYear}` : ""})
                    </span>
                  )}
                </p>
                <p className="text-brand-600">
                  {participant.email ? (
                    <>E-Mail: {participant.email}</>
                  ) : (
                    <>
                      Kontakt über {user.name}: {user.email}
                    </>
                  )}
                  {" · "}angemeldet am {new Intl.DateTimeFormat("de-DE").format(createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
                <select name="weekday" required defaultValue={slot.weekday} className={INPUT}>
                  {Object.values(Weekday).map((day) => (
                    <option key={day} value={day}>
                      {WEEKDAY_LABELS[day] ?? day}
                    </option>
                  ))}
                </select>
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
        {upcomingSessions.length === 0 && (
          <p className="text-sm text-brand-600">Keine kommenden Sitzungen geplant.</p>
        )}
        <ul className="space-y-2">
          {upcomingSessions.map((classSession) => (
            <SessionRow key={sessionKey(classSession)} classSession={classSession} courseId={course.id} />
          ))}
        </ul>
        {pastSessions.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-brand-700">
              Vergangene Sitzungen ({pastSessions.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {pastSessions.map((classSession) => (
                <SessionRow key={sessionKey(classSession)} classSession={classSession} courseId={course.id} />
              ))}
            </ul>
          </details>
        )}

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

      <section aria-labelledby="mail" className="space-y-4">
        <h2 id="mail" className="font-semibold text-brand-700">
          E-Mail an Teilnehmer (Kursmaterial, Ankündigungen)
        </h2>
        <p className="text-sm text-brand-600">
          Schreibe an alle Teilnehmer dieses Kurses oder an einzelne und hänge Dateien aus deiner{" "}
          <Link href="/teacher/mediathek" className="font-medium text-azure-800 underline">
            Mediathek
          </Link>{" "}
          an. Die Nachricht wird getrennt von den automatischen Sitzungs-Erinnerungen verschickt.
        </p>
        <EmailComposer
          courses={[
            {
              id: course.id,
              title: course.title,
              participants: course.enrollments.map(({ participant, user }) => ({
                id: participant.id,
                name: participant.name,
                detail: participant.email
                  ? `(${participant.email})`
                  : `(Mail an ${user.name}, ${user.email})`,
              })),
            },
          ]}
          files={composerFiles}
          upload={{
            blobEnabled: isBlobConfigured(),
            blobAccess: blobAccess(),
            userId: session?.user.id ?? "",
          }}
        />
      </section>

      <section className="space-y-4">
        <h2 className="font-semibold text-brand-700">WhatsApp-Gruppe des Kurses</h2>
        {whatsappMembers.length === 0 ? (
          <p className="text-sm text-brand-600">
            Noch niemand hat eine WhatsApp-Nummer für die Kurs-Gruppe angegeben.
          </p>
        ) : (
          <div className="rounded-lg border border-brand-200 bg-white p-5">
            <p className="mb-3 text-sm text-brand-600">
              Diese Teilnehmer haben der Aufnahme in die WhatsApp-Gruppe zugestimmt. Bei Kindern ist
              es die Nummer der Eltern. Bitte verwende die Nummern nur dafür.
            </p>
            <ul className="divide-y divide-brand-100 text-sm">
              {whatsappMembers.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <span className="font-medium">{m.name}</span>
                  <span className="text-brand-700">{m.whatsapp}</span>
                  <CopyButton text={m.whatsapp} ariaLabel={`Nummer von ${m.name} kopieren`} />
                </li>
              ))}
            </ul>
            {whatsappMembers.length > 1 && (
              <div className="mt-3 border-t border-brand-100 pt-3">
                <CopyButton
                  text={whatsappMembers.map((m) => m.whatsapp).join("\n")}
                  label={`Alle ${whatsappMembers.length} Nummern kopieren`}
                />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
