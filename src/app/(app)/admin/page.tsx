import Link from "next/link";

import { prisma } from "@/lib/prisma";
import {
  createTeacherAccount,
  regenerateAccessCode,
  resendTeacherInvite,
  updateCourseSettings,
  updateLegalTexts,
  updateSiteContent,
  updateTeacherProfile,
} from "@/lib/admin-actions";
import { getAppUrl } from "@/lib/app-url";
import { isZoomProvider } from "@/lib/classroom";
import { CopyButton } from "@/components/copy-button";
import { isGoogleAuthConfigured } from "@/lib/auth-providers";
import { DEFAULT_IMPRESSUM, defaultPrivacyPolicy } from "@/lib/legal-defaults";
import { formatGermanDateTime } from "@/lib/schedule-time";
import { togglePublish } from "@/lib/teacher-actions";

function minutesSince(date: Date | null) {
  return date ? Math.round((Date.now() - date.getTime()) / 60_000) : null;
}

// Zeigt den aktuellen Stand (Erinnerungs-Status, Kurse) und darf nicht zwischengespeichert werden.
export const dynamic = "force-dynamic";

// Der Taktgeber fuer Erinnerungen ruft alle 15 Minuten an. Bleibt er laenger aus, gehen keine
// Erinnerungen raus; das soll hier auffallen.
function ReminderStatus({ lastRunAt, minutesAgo }: { lastRunAt: Date | null; minutesAgo: number | null }) {
  const ok = minutesAgo !== null && minutesAgo <= 35;
  return (
    <section
      className={`border p-4 text-sm ${ok ? "border-brand-200 bg-brand-50" : "border-red-300 bg-red-50"}`}
    >
      <h2 className="font-semibold text-azure-800">Erinnerungs-Mails</h2>
      <p className="mt-1 text-brand-900">
        {minutesAgo === null
          ? "Der Taktgeber hat sich noch nie gemeldet. Ohne ihn werden keine Erinnerungen verschickt (Einrichtung siehe README)."
          : ok
            ? `In Ordnung: zuletzt vor ${minutesAgo} Minuten geprüft (${formatGermanDateTime(lastRunAt!)} Uhr).`
            : `Achtung: zuletzt vor ${minutesAgo} Minuten geprüft (${formatGermanDateTime(lastRunAt!)} Uhr). Bitte den Taktgeber (cron-job.org) kontrollieren.`}
      </p>
    </section>
  );
}

const INVITE_NOTICES: Record<string, { ok: boolean; text: string }> = {
  gesendet: { ok: true, text: "Die Einladung wurde per E-Mail verschickt." },
  lokal: {
    ok: true,
    text: "Kein E-Mail-Dienst eingerichtet (lokal): Der Einladungslink steht in der Server-Konsole.",
  },
  fehler: {
    ok: false,
    text: "Der Zugang ist gespeichert, aber die E-Mail konnte nicht verschickt werden. Bitte später „Einladung erneut senden“.",
  },
  vergeben: { ok: false, text: "Diese E-Mail-Adresse gehört schon zu einem anderen Konto." },
  ungueltig: { ok: false, text: "Bitte Name und eine gültige E-Mail-Adresse angeben." },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ einladung?: string }>;
}) {
  const { einladung } = await searchParams;
  const inviteNotice = einladung ? INVITE_NOTICES[einladung] : undefined;

  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { taughtCourses: true } } },
  });

  const siteContent = await prisma.siteContent.findUnique({ where: { id: "main" } });
  const remindersLastRunAt = siteContent?.remindersLastRunAt ?? null;

  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { name: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-azure-800">Admin-Bereich</h1>

      <ReminderStatus lastRunAt={remindersLastRunAt} minutesAgo={minutesSince(remindersLastRunAt)} />

      <section id="lehrer" className="border border-gold-400/40 bg-white p-5">
        <h2 className="mb-4 font-semibold text-azure-800">Lehrer</h2>

        {inviteNotice && (
          <p
            role={inviteNotice.ok ? "status" : "alert"}
            className={`mb-4 border px-3 py-2 text-sm ${inviteNotice.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-800"}`}
          >
            {inviteNotice.text}
          </p>
        )}

        {teachers.length === 0 ? (
          <p className="mb-4 text-sm text-brand-600">Noch keine Lehrer angelegt.</p>
        ) : (
          <div className="mb-4 space-y-2">
            {teachers.map((teacher) => (
              <details key={teacher.id} className="border border-brand-300 px-3 py-2">
                <summary className="cursor-pointer text-sm text-brand-900">
                  {teacher.name} ({teacher.email}) · {teacher._count.taughtCourses} Kurse
                </summary>
                <form
                  action={updateTeacherProfile}
                  className="mt-3 grid gap-2 border-t border-brand-100 pt-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="teacherId" value={teacher.id} />
                  <label className="flex flex-col text-xs text-brand-700 sm:col-span-2">
                    E-Mail-Adresse (Anmeldung)
                    <input
                      name="email"
                      type="email"
                      required
                      defaultValue={teacher.email}
                      className="mt-1 border border-brand-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <input
                    name="image"
                    placeholder="Foto-URL (https://...)"
                    defaultValue={teacher.image ?? ""}
                    className="border border-brand-300 px-3 py-2 text-sm"
                  />
                  <input
                    name="zoomEmail"
                    type="email"
                    placeholder="Zoom-Konto (E-Mail, nur bei Zoom-Betrieb)"
                    defaultValue={teacher.zoomEmail ?? ""}
                    className="border border-brand-300 px-3 py-2 text-sm sm:col-span-2"
                  />
                  <textarea
                    name="bio"
                    placeholder="Kurze Vita"
                    defaultValue={teacher.bio ?? ""}
                    rows={2}
                    className="border border-brand-300 px-3 py-2 text-sm sm:col-span-2"
                  />
                  <button className="btn-primary px-4 py-1.5 text-sm sm:col-span-2 sm:w-fit">
                    Profil speichern
                  </button>
                </form>
                <form
                  action={resendTeacherInvite}
                  className="mt-3 flex flex-wrap items-center gap-3 border-t border-brand-100 pt-3 text-sm"
                >
                  <input type="hidden" name="teacherId" value={teacher.id} />
                  <button className="border border-brand-300 px-3 py-1.5 text-brand-800 hover:bg-brand-50">
                    Einladung erneut senden
                  </button>
                  <span className="text-xs text-brand-600">
                    Schickt einen neuen Link zum Festlegen des Passworts an {teacher.email}.
                  </span>
                </form>
              </details>
            ))}
          </div>
        )}

        <h3 className="mb-2 text-sm font-semibold text-azure-800">Lehrer einladen</h3>
        <p className="mb-3 text-sm text-brand-600">
          Die Lehrkraft bekommt eine E-Mail mit einem Link (7 Tage gültig), über den sie ihr
          eigenes Passwort festlegt. Danach meldet sie sich mit ihrer E-Mail-Adresse an.
        </p>
        <form action={createTeacherAccount} className="grid gap-3 sm:grid-cols-2">
          <input
            name="name"
            placeholder="Name"
            required
            minLength={2}
            className="border border-brand-300 px-3 py-2"
          />
          <input
            name="email"
            type="email"
            placeholder="E-Mail-Adresse der Lehrkraft"
            required
            className="border border-brand-300 px-3 py-2"
          />
          <button className="btn-primary col-span-full px-4 py-2">
            Lehrer anlegen und einladen
          </button>
        </form>
      </section>

      <section className="border border-gold-400/40 bg-white p-5">
        <h2 className="mb-4 font-semibold text-azure-800">Website-Inhalte</h2>
        <form action={updateSiteContent} className="space-y-3">
          <label className="block text-sm text-brand-700">
            Statement of Purpose (Seite &quot;Ziel &amp; Zweck&quot;)
            <textarea
              name="missionStatement"
              defaultValue={siteContent?.missionStatement ?? ""}
              rows={6}
              placeholder="Unser Ziel ist es, hochwertigen Quran-Unterricht kostengünstig und für jeden zugänglich zu machen..."
              className="mt-1 w-full border border-brand-300 px-3 py-2 text-sm"
            />
          </label>
          <button className="btn-primary px-4 py-2">
            Text speichern
          </button>
        </form>
      </section>

      <section className="border border-gold-400/40 bg-white p-5">
        <h2 className="mb-1 font-semibold text-azure-800">Rechtstexte</h2>
        <p className="mb-4 text-sm text-brand-600">
          Impressum und Datenschutzerklärung der Website. Absätze durch Leerzeilen trennen,
          Zwischenüberschriften mit &quot;## &quot; am Zeilenanfang. Angezeigt wird der hier
          gespeicherte Text; ist nichts gespeichert, erscheint der Standard-Entwurf. Angaben in
          [eckigen Klammern] müssen ergänzt werden, und die Texte sollten juristisch geprüft
          werden.
        </p>
        <form action={updateLegalTexts} className="space-y-4">
          <label className="block text-sm text-brand-700">
            Impressum
            <textarea
              name="impressum"
              defaultValue={siteContent?.impressum || DEFAULT_IMPRESSUM}
              rows={14}
              className="mt-1 w-full border border-brand-300 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm text-brand-700">
            Datenschutzerklärung
            <textarea
              name="privacyPolicy"
              defaultValue={siteContent?.privacyPolicy || defaultPrivacyPolicy(isZoomProvider(), isGoogleAuthConfigured())}
              rows={24}
              className="mt-1 w-full border border-brand-300 px-3 py-2 font-mono text-sm"
            />
          </label>
          <button className="btn-primary px-4 py-2">
            Rechtstexte speichern
          </button>
        </form>
      </section>

      <section className="border border-gold-400/40 bg-white p-5">
        <h2 className="mb-4 font-semibold text-azure-800">Alle Kurse</h2>

        {courses.length === 0 ? (
          <p className="text-sm text-brand-600">Noch keine Kurse angelegt.</p>
        ) : (
          <ul className="space-y-2">
            {courses.map((course) => {
              const secretLink =
                course.isHidden && course.accessCode ? `${getAppUrl()}/zugang/${course.accessCode}` : null;
              return (
                <li key={course.id} className="bg-brand-50 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      {course.title} · Lehrer: {course.teacher.name} · {course._count.enrollments}{" "}
                      Schüler · {course.isPublished ? "veröffentlicht" : "Entwurf"}
                      {course.isHidden && " · versteckt"}
                    </span>
                    <div className="flex gap-3">
                      <Link href={`/teacher/courses/${course.id}`} className="underline">
                        Sitzungen
                      </Link>
                      <form action={togglePublish}>
                        <input type="hidden" name="courseId" value={course.id} />
                        <button className="underline">
                          {course.isPublished ? "Entwurf setzen" : "Veröffentlichen"}
                        </button>
                      </form>
                    </div>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-brand-700">Preis, Plätze und Sichtbarkeit</summary>
                    <form action={updateCourseSettings} className="mt-2 grid gap-2 sm:grid-cols-2">
                      <input type="hidden" name="courseId" value={course.id} />
                      <label className="text-brand-700">
                        Preis pro Monat in € (0 = kostenlos)
                        <input
                          name="price"
                          inputMode="decimal"
                          defaultValue={(course.priceCents / 100).toFixed(2).replace(".", ",")}
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5"
                        />
                      </label>
                      <label className="text-brand-700">
                        Stripe-Preis-ID (monatlich, price_...)
                        <input
                          name="stripePriceId"
                          defaultValue={course.stripePriceId ?? ""}
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5 font-mono"
                        />
                      </label>
                      <label className="text-brand-700">
                        Einmalige Anmeldegebühr in € (leer = keine)
                        <input
                          name="signupFee"
                          inputMode="decimal"
                          defaultValue={
                            course.signupFeeCents != null
                              ? (course.signupFeeCents / 100).toFixed(2).replace(".", ",")
                              : ""
                          }
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5"
                        />
                      </label>
                      <label className="text-brand-700">
                        Stripe-Preis-ID der Gebühr (einmalig, price_...)
                        <input
                          name="signupFeePriceId"
                          defaultValue={course.signupFeePriceId ?? ""}
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5 font-mono"
                        />
                      </label>
                      <label className="text-brand-700">
                        Höchstzahl Teilnehmer (leer = unbegrenzt)
                        <input
                          name="maxParticipants"
                          type="number"
                          min={1}
                          defaultValue={course.maxParticipants ?? ""}
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5"
                        />
                      </label>
                      <label className="flex items-center gap-2 self-end text-brand-700">
                        <input type="checkbox" name="isHidden" defaultChecked={course.isHidden} />
                        Versteckt (nur über geheimen Link erreichbar)
                      </label>
                      <button className="btn-primary px-4 py-1.5 sm:col-span-2 sm:w-fit">
                        Einstellungen speichern
                      </button>
                    </form>
                    {secretLink && (
                      <div className="mt-3 border-t border-brand-200 pt-3">
                        <p className="text-brand-700">
                          Geheimer Link (der Kurs muss außerdem veröffentlicht sein):
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <code className="break-all bg-white px-2 py-1">{secretLink}</code>
                          <CopyButton text={secretLink} />
                          <form action={regenerateAccessCode}>
                            <input type="hidden" name="courseId" value={course.id} />
                            <button className="underline">Neuen Link erzeugen</button>
                          </form>
                        </div>
                      </div>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
