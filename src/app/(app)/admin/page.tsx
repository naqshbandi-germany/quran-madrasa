import Link from "next/link";

import { auth } from "@/auth";
import { InviteForm } from "@/components/invite-form";
import { NotificationsFeed } from "@/components/notifications-feed";
import { TeacherPhotoForm } from "@/components/teacher-photo-form";
import { inviteStaff, resendStaffInvite } from "@/lib/invite-actions";
import { prisma } from "@/lib/prisma";
import { TIME_ZONE_OPTIONS, teacherTimeZone } from "@/lib/time-zones";
import {
  updateLegalTexts,
  updateSiteContent,
  updateTeacherProfile,
} from "@/lib/admin-actions";
import { isZoomProvider } from "@/lib/classroom";
import { ViewAsPicker } from "@/components/view-as-picker";
import { isGoogleAuthConfigured } from "@/lib/auth-providers";
import { DEFAULT_IMPRESSUM, defaultPrivacyPolicy } from "@/lib/legal-defaults";
import { formatGermanDateTime } from "@/lib/schedule-time";

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

// Rueckmeldung nach dem Speichern eines Lehrerprofils (?einladung=...).
const INVITE_NOTICES: Record<string, { ok: boolean; text: string }> = {
  vergeben: { ok: false, text: "Diese E-Mail-Adresse gehört schon zu einem anderen Konto." },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ einladung?: string }>;
}) {
  const { einladung } = await searchParams;
  const inviteNotice = einladung ? INVITE_NOTICES[einladung] : undefined;

  const session = await auth();
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { taughtCourses: true } } },
  });
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true },
  });

  // Fuer den Entwicklermodus; die neuesten Schueler zuerst (weitere ueber "Konten").
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, name: true, email: true },
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

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-azure-800">Neueste Benachrichtigungen</h2>
          <Link href="/admin/benachrichtigungen" className="text-sm font-medium text-brand-700 underline">
            Alle ansehen
          </Link>
        </div>
        {session && (
          <NotificationsFeed userId={session.user.id} role={session.user.role} basePath="/admin/benachrichtigungen" compact />
        )}
      </section>

      <ReminderStatus lastRunAt={remindersLastRunAt} minutesAgo={minutesSince(remindersLastRunAt)} />

      <ViewAsPicker
        teachers={teachers.map((t) => ({ id: t.id, name: t.name, email: t.email }))}
        students={students}
      />

      <section id="lehrer" className="border border-gold-400/40 bg-white p-5">
        <h2 className="mb-4 font-semibold text-azure-800">Lehrer und Admins</h2>

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
                <div className="mt-3 border-t border-brand-100 pt-3">
                  <TeacherPhotoForm teacherId={teacher.id} teacherName={teacher.name} image={teacher.image} />
                </div>
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
                    name="zoomEmail"
                    type="email"
                    placeholder="Zoom-Konto (E-Mail, nur bei Zoom-Betrieb)"
                    defaultValue={teacher.zoomEmail ?? ""}
                    className="border border-brand-300 px-3 py-2 text-sm sm:col-span-2"
                  />
                  <label className="flex flex-col text-sm text-brand-700 sm:col-span-2">
                    Zeitzone (für Kurszeiten und die Anzeige im Lehrer-Bereich)
                    <select
                      name="timeZone"
                      defaultValue={teacherTimeZone(teacher)}
                      className="mt-1 border border-brand-300 bg-white px-3 py-2 text-sm"
                    >
                      {TIME_ZONE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
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
                <div className="mt-3 border-t border-brand-100 pt-3">
                  <p className="mb-2 text-xs text-brand-600">
                    Neuer Link zum Festlegen des Passworts für {teacher.email}:
                  </p>
                  <InviteForm
                    action={resendStaffInvite}
                    mailLabel="Einladung erneut senden"
                    linkLabel="Neuen Link erstellen"
                  >
                    <input type="hidden" name="userId" value={teacher.id} />
                  </InviteForm>
                </div>
                <p className="mt-3 border-t border-brand-100 pt-3 text-sm">
                  <Link href={`/admin/konten/${teacher.id}`} className="font-medium text-red-800 underline">
                    Lehrer-Konto löschen …
                  </Link>{" "}
                  <span className="text-xs text-brand-600">
                    Vorher werden die Kurse und die Mediathek einer anderen Lehrkraft zugeordnet. Hat
                    die Lehrkraft nur eine neue E-Mail-Adresse, nicht löschen: oben die Adresse ändern
                    und die Einladung erneut senden.
                  </span>
                </p>
              </details>
            ))}
          </div>
        )}

        {admins.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-azure-800">Admins</h3>
            <ul className="space-y-2">
              {admins.map((admin) => (
                <li key={admin.id} className="border border-brand-300 px-3 py-2 text-sm">
                  <details>
                    <summary className="cursor-pointer text-brand-900">
                      {admin.name} ({admin.email})
                      {admin.id === session?.user.id ? " · du" : ""}
                    </summary>
                    {admin.id !== session?.user.id && (
                      <InviteForm
                        action={resendStaffInvite}
                        mailLabel="Einladung erneut senden"
                        linkLabel="Neuen Link erstellen"
                        className="mt-3 border-t border-brand-100 pt-3"
                      >
                        <input type="hidden" name="userId" value={admin.id} />
                      </InviteForm>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          </div>
        )}

        <h3 className="mb-2 text-sm font-semibold text-azure-800">Lehrer oder Admin einladen</h3>
        <p className="mb-3 text-sm text-brand-600">
          Die Person bekommt einen Link (7 Tage gültig, einmal nutzbar), über den sie ihr eigenes
          Passwort festlegt. Danach meldet sie sich mit ihrer E-Mail-Adresse an. Den Link
          verschickst du per E-Mail oder kopierst ihn, z. B. für WhatsApp.
        </p>
        <InviteForm action={inviteStaff}>
          <div className="grid gap-3 sm:grid-cols-3">
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
              placeholder="E-Mail-Adresse (Anmeldung)"
              required
              className="border border-brand-300 px-3 py-2"
            />
            <select name="role" defaultValue="TEACHER" aria-label="Rolle" className="border border-brand-300 bg-white px-3 py-2">
              <option value="TEACHER">als Lehrer</option>
              <option value="ADMIN">als Admin (alle Rechte)</option>
            </select>
          </div>
        </InviteForm>
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

    </div>
  );
}
