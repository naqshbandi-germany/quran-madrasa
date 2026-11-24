import Link from "next/link";

import { auth } from "@/auth";
import { NotificationsFeed } from "@/components/notifications-feed";
import { prisma } from "@/lib/prisma";
import {
  updateLegalTexts,
  updateSiteContent,
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

export default async function AdminPage() {
  const session = await auth();
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "desc" },
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
        teachers={teachers}
        students={students}
      />

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
