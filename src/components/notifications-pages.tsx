import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { NotificationSettingsForm } from "@/components/notification-settings-form";
import { NotificationsFeed } from "@/components/notifications-feed";
import { emailWanted, notificationsBasePath } from "@/lib/notifications";
import { typesForRole } from "@/lib/notification-types";

// Gemeinsame Seiten fuer /teacher/benachrichtigungen und /admin/benachrichtigungen.

export async function NotificationsPage({ searchParams }: { searchParams: Promise<{ typ?: string }> }) {
  const session = await auth();
  if (!session) return null;
  const basePath = notificationsBasePath(session.user.role);
  const { typ } = await searchParams;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-azure-800">Benachrichtigungen</h1>
          <p className="mt-1 text-sm text-brand-600">
            {session.user.role === "ADMIN"
              ? "Ereignisse aus deinen Kursen und fehlgeschlagene Zahlungen."
              : "Was in deinen Kursen passiert: neue Anmeldungen, Kündigungen, Leseproben und Einträge auf der Warteliste."}
          </p>
        </div>
        <Link href={`${basePath}/einstellungen`} className="text-sm font-medium text-brand-700 underline">
          E-Mail-Einstellungen
        </Link>
      </div>
      <NotificationsFeed userId={session.user.id} role={session.user.role} basePath={basePath} filter={typ} />
    </div>
  );
}

export async function NotificationSettingsPage({ area }: { area: "teacher" | "admin" }) {
  const session = await auth();
  if (!session) return null;
  const basePath = notificationsBasePath(session.user.role);
  if (!basePath.startsWith(`/${area}`)) redirect(`${basePath}/einstellungen`);
  const types = typesForRole(session.user.role);
  const email = Object.fromEntries(
    await Promise.all(types.map(async (t) => [t, await emailWanted(session.user.id, t)] as const)),
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-azure-800">E-Mail-Einstellungen</h1>
        <p className="mt-1 text-sm text-brand-600">
          Alle Ereignisse erscheinen unter „Benachrichtigungen“. Hier legst du fest, bei welchen du
          zusätzlich eine E-Mail an {session.user.email} bekommst.
        </p>
      </div>
      <NotificationSettingsForm types={types} email={email} />
      <Link href={basePath} className="inline-block text-sm font-medium text-brand-700 underline">
        Zurück zu den Benachrichtigungen
      </Link>
    </div>
  );
}
