import Link from "next/link";

import { auth } from "@/auth";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import { TimeZoneNotice } from "@/components/time-zone-notice";
import { TrialCancelButton } from "@/components/trial-cancel-button";
import { editableEmail } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";
import { formatReminderDate } from "@/lib/reminder-email";
import { removeTrialGuest, toggleTrialSampleListened } from "@/lib/trial-actions";
import { resolveViewTimeZone } from "@/lib/view-time-zone";
import { formatZonedDateTime } from "@/lib/schedule-time";

export const metadata = { title: "Termine" };
export const dynamic = "force-dynamic";

const TH = "px-4 py-2 font-semibold";
const TD = "px-4 py-3 align-top";

// Alle Termine im Ueberblick: Kursstunden und Probestunden, jeweils in einer eigenen Tabelle.
// Lehrkraefte sehen ihre Kurse, Admins alle. Standard: kommende Termine; ?zeit=vergangen zeigt
// die letzten 60 Tage.
export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ zeit?: string }> }) {
  const session = await auth();
  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN";
  const { zeit } = await searchParams;
  const past = zeit === "vergangen";
  const { timeZone, ownTimeZone, showingOwn } = await resolveViewTimeZone(session.user.id);

  const now = new Date();
  const range = past ? { gte: new Date(now.getTime() - 60 * 24 * 3600_000), lt: now } : { gte: new Date(now.getTime() - 2 * 3600_000) };
  const courseWhere = isAdmin ? {} : { course: { teacherId: session.user.id } };

  const [sessions, trials, cancelEmail] = await Promise.all([
    prisma.classSession.findMany({
      where: { startsAt: range, ...courseWhere },
      orderBy: { startsAt: past ? "desc" : "asc" },
      take: 200,
      include: {
        course: { select: { id: true, title: true, teacher: { select: { name: true } }, _count: { select: { enrollments: true } } } },
      },
    }),
    prisma.trialLesson.findMany({
      where: { startsAt: range, ...courseWhere },
      orderBy: { startsAt: past ? "desc" : "asc" },
      take: 200,
      include: {
        guests: {
          orderBy: { createdAt: "asc" },
          include: {
            samples: { orderBy: { createdAt: "desc" }, select: { id: true, createdAt: true, durationSec: true, note: true, listenedAt: true } },
          },
        },
        course: { select: { id: true, title: true, teacher: { select: { name: true } } } },
      },
    }),
    editableEmail("trial_cancelled", session.user.id),
  ]);

  const when = (date: Date) => `${formatZonedDateTime(date, timeZone)} Uhr`;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-azure-800">Termine</h1>
          <p className="mt-1 text-sm text-brand-600">
            {past ? "Termine der letzten 60 Tage." : "Kommende Kursstunden und Probestunden."}{" "}
            {isAdmin ? "Alle Kurse." : "Deine Kurse."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href={past ? "/teacher/termine" : "/teacher/termine?zeit=vergangen"} className="font-medium text-brand-700 underline">
            {past ? "Kommende Termine" : "Vergangene Termine"}
          </Link>
          <Link href="/teacher/schueler/einladen" className="btn-primary px-4 py-2">
            Zur Probestunde einladen
          </Link>
        </div>
      </div>

      <TimeZoneNotice timeZone={timeZone} ownTimeZone={ownTimeZone} showingOwn={showingOwn} />

      <section aria-labelledby="kurstermine" className="space-y-3">
        <h2 id="kurstermine" className="font-semibold text-azure-800">
          Kursstunden ({sessions.length})
        </h2>
        {sessions.length === 0 ? (
          <p className="border border-brand-200 bg-white p-4 text-sm text-brand-600">Keine Kursstunden in diesem Zeitraum.</p>
        ) : (
          <div className="overflow-x-auto border border-brand-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-200 bg-brand-50 text-brand-700">
                <tr>
                  <th scope="col" className={TH}>Datum und Uhrzeit</th>
                  <th scope="col" className={TH}>Kurs</th>
                  <th scope="col" className={TH}>Stunde</th>
                  {isAdmin && <th scope="col" className={TH}>Lehrkraft</th>}
                  <th scope="col" className={TH}>Teilnehmer</th>
                  <th scope="col" className={TH}><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200">
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className={`${TD} whitespace-nowrap`}>
                      {when(s.startsAt)}
                      <span className="block text-xs text-brand-600">{s.durationMin} Minuten</span>
                    </td>
                    <td className={TD}>
                      <Link href={`/teacher/courses/${s.course.id}`} className="text-brand-700 underline">
                        {s.course.title}
                      </Link>
                    </td>
                    <td className={TD}>{s.title}</td>
                    {isAdmin && <td className={TD}>{s.course.teacher.name}</td>}
                    <td className={TD}>{s.course._count.enrollments}</td>
                    <td className={`${TD} whitespace-nowrap text-right`}>
                      {s.joinUrl && !past && (
                        <a href={s.joinUrl} target="_blank" rel="noopener noreferrer" className="mr-3 font-medium text-brand-700 underline">
                          Raum öffnen
                        </a>
                      )}
                      <Link href={`/teacher/courses/${s.course.id}/sitzungen/${s.id}`} className="font-medium text-brand-700 underline">
                        Auswerten
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="probestunden" className="space-y-3">
        <h2 id="probestunden" className="font-semibold text-azure-800">
          Probestunden ({trials.length})
        </h2>
        {trials.length === 0 ? (
          <p className="border border-brand-200 bg-white p-4 text-sm text-brand-600">
            Keine Probestunden in diesem Zeitraum.{" "}
            <Link href="/teacher/schueler/einladen" className="underline">
              Jemanden zur Probestunde einladen
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto border border-brand-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-200 bg-brand-50 text-brand-700">
                <tr>
                  <th scope="col" className={TH}>Datum und Uhrzeit</th>
                  <th scope="col" className={TH}>Kurs</th>
                  {isAdmin && <th scope="col" className={TH}>Lehrkraft</th>}
                  <th scope="col" className={TH}>Eingeladen</th>
                  <th scope="col" className={TH}><span className="sr-only">Aktionen</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200">
                {trials.map((t) => (
                  <tr key={t.id} className={t.canceledAt ? "text-brand-500" : undefined}>
                    <td className={`${TD} whitespace-nowrap`}>
                      <span className={t.canceledAt ? "line-through" : undefined}>{when(t.startsAt)}</span>
                      <span className="block text-xs text-brand-600">
                        {t.canceledAt ? "abgesagt" : `${t.durationMin} Minuten`}
                      </span>
                    </td>
                    <td className={TD}>
                      <Link href={`/teacher/courses/${t.course.id}`} className="text-brand-700 underline">
                        {t.course.title}
                      </Link>
                    </td>
                    {isAdmin && <td className={TD}>{t.course.teacher.name}</td>}
                    <td className={TD}>
                      {t.guests.map((g) => (
                        <div key={g.id} className="py-0.5">
                          {g.name}
                          {g.email && (
                            <>
                              {" "}
                              <a href={`mailto:${g.email}`} className="text-brand-600 underline">
                                {g.email}
                              </a>
                            </>
                          )}{" "}
                          <form action={removeTrialGuest} className="inline">
                            <input type="hidden" name="guestId" value={g.id} />
                            <ConfirmButton
                              message={`${g.name}${g.email ? ` (${g.email})` : ""} aus der Probestunde am ${when(t.startsAt)} entfernen? Eine Hörprobe wird mitgelöscht. Der Gast bekommt keine Nachricht.`}
                              aria-label={`${g.name} entfernen`}
                              className="text-xs text-red-700 underline hover:text-red-800"
                            >
                              Entfernen
                            </ConfirmButton>
                          </form>
                          {g.sampleRequest && (
                            <div className="mt-1 space-y-1 border-l-2 border-gold-400 pl-2 text-xs text-brand-700">
                              <p>
                                Hörprobe erbeten: {g.sampleRequest}
                                {g.samples.length === 0 && <span className="text-brand-500"> · noch keine Aufnahme</span>}
                              </p>
                              {g.samples.map((s) => (
                                <div key={s.id} className="space-y-1">
                                  <audio
                                    controls
                                    preload="none"
                                    src={`/api/probestunde/hoerprobe/${s.id}`}
                                    className="h-8 w-full max-w-xs"
                                  />
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span>
                                      {when(s.createdAt)}
                                      {s.durationSec ? ` · ${Math.floor(s.durationSec / 60)}:${String(s.durationSec % 60).padStart(2, "0")} Min.` : ""}
                                    </span>
                                    <form action={toggleTrialSampleListened}>
                                      <input type="hidden" name="sampleId" value={s.id} />
                                      <button type="submit" className={s.listenedAt ? "text-green-800" : "font-medium text-azure-800 underline"}>
                                        {s.listenedAt ? "✓ gehört" : "Als gehört markieren"}
                                      </button>
                                    </form>
                                  </div>
                                  {s.note && <p>Hinweis: {s.note}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-right`}>
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        {!t.canceledAt && t.guests.length > 0 && (
                          <Link
                            href={`/teacher/schueler/einladen?gaeste=${t.id}`}
                            className="font-medium text-brand-700 underline"
                            title="Die Gäste dieser Probestunde zur Anmeldung im Kurs einladen"
                          >
                            Gäste zum Kurs einladen
                          </Link>
                        )}
                        {!t.canceledAt && !past && (
                          <>
                            <Link
                              href={`/teacher/schueler/einladen?probestunde=${t.id}`}
                              className="font-medium text-brand-700 underline"
                            >
                              Weitere einladen
                            </Link>
                            <a href={t.joinUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-700 underline">
                              Raum öffnen
                            </a>
                            <CopyButton text={t.joinUrl} label="Link kopieren" />
                            <TrialCancelButton
                              trialId={t.id}
                              editable={cancelEmail}
                              guestCount={t.guests.filter((g) => g.email).length}
                              values={{
                                ...(t.guests[0] ? { name: t.guests[0].name } : {}),
                                kurs: t.course.title,
                                datum: formatReminderDate(t.startsAt),
                              }}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
