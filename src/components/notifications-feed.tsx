import Link from "next/link";

import { markAllNotificationsRead, markNotificationRead } from "@/lib/notification-actions";
import {
  NOTIFICATION_TYPE_INFO,
  describeEvent,
  eventHref,
  eventParticipants,
  isNotificationType,
  studentHref,
  typesForRole,
  type EventData,
} from "@/lib/notification-types";
import { prisma } from "@/lib/prisma";
import { formatGermanDateTime } from "@/lib/schedule-time";

const PAGE_SIZE = 100;

// Feed der Benachrichtigungen einer Person (Lehrkraft oder Admin) mit Filter nach Typ.
export async function NotificationsFeed({
  userId,
  role,
  basePath,
  filter,
  compact = false,
}: {
  userId: string;
  role: string;
  basePath: string;
  filter?: string;
  // Kurzfassung fuer die Startseite: nur die neuesten fuenf, ohne Filter.
  compact?: boolean;
}) {
  const type = filter && isNotificationType(filter) ? filter : undefined;
  const types = typesForRole(role);
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, ...(type ? { event: { type } } : {}) },
      orderBy: { createdAt: "desc" },
      take: compact ? 5 : PAGE_SIZE,
      include: { event: true },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  // Schuelerprofile nur verlinken, wenn sie fuer diese Person noch erreichbar sind.
  const participantIds = notifications.flatMap((n) =>
    eventParticipants(n.event.participantId, (n.event.data ?? {}) as EventData).map((p) => p.id),
  );
  const reachable = new Set(
    (
      await prisma.enrollment.findMany({
        where: { participantId: { in: participantIds }, ...(role === "ADMIN" ? {} : { course: { teacherId: userId } }) },
        select: { participantId: true },
      })
    ).map((e) => e.participantId),
  );

  const filterLink = (value?: string) => {
    const active = value === type;
    return (
      <Link
        key={value ?? "alle"}
        href={value ? `${basePath}?typ=${value}` : basePath}
        aria-current={active ? "page" : undefined}
        className={`rounded-full border px-3 py-1 text-sm ${
          active
            ? "border-azure-700 bg-azure-700 text-white"
            : "border-brand-300 bg-white text-brand-800 hover:border-azure-700"
        }`}
      >
        {value ? NOTIFICATION_TYPE_INFO[value as keyof typeof NOTIFICATION_TYPE_INFO].label : "Alle"}
      </Link>
    );
  };

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Nach Ereignis filtern" className="flex flex-wrap gap-2">
            {filterLink(undefined)}
            {types.map((t) => filterLink(t))}
          </nav>
          {unreadCount > 0 && (
            <form action={markAllNotificationsRead}>
              <button className="text-sm font-medium text-brand-700 underline">
                Alle als gelesen markieren ({unreadCount})
              </button>
            </form>
          )}
        </div>
      )}

      {notifications.length === 0 ? (
        <p className="border border-brand-200 bg-white p-4 text-sm text-brand-600">
          {type ? "Zu diesem Ereignis gibt es noch keine Benachrichtigungen." : "Noch keine Benachrichtigungen."}
        </p>
      ) : (
        <ul className="divide-y divide-brand-200 border border-brand-200 bg-white">
          {notifications.map((n) => {
            const eventType = n.event.type;
            const data = (n.event.data ?? {}) as EventData;
            const { title, detail } = describeEvent(eventType, data);
            const people = eventParticipants(n.event.participantId, data).filter((p) => reachable.has(p.id));
            const href = eventHref(eventType, n.event.courseId, data, people.length === 1 ? people[0].id : null);
            const unread = !n.readAt;
            return (
              <li key={n.id} className={`flex gap-3 p-4 ${unread ? "bg-azure-50/60" : ""}`}>
                <span
                  aria-hidden="true"
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${unread ? "bg-azure-700" : "bg-transparent"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-brand-900 ${unread ? "font-semibold" : "font-medium"}`}>
                    {unread && <span className="sr-only">Ungelesen: </span>}
                    {title}
                  </p>
                  <p className="mt-0.5 text-sm text-brand-700">{detail}</p>
                  {people.length > 0 && (
                    <p className="mt-1 flex flex-wrap gap-x-3 text-sm">
                      {people.map((p) => (
                        <Link key={p.id} href={studentHref(p.id)} className="text-brand-700 underline">
                          Schülerprofil: {p.name}
                        </Link>
                      ))}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-brand-600">
                    <span>{formatGermanDateTime(n.createdAt)} Uhr</span>
                    <span>{NOTIFICATION_TYPE_INFO[eventType].label}</span>
                    {n.emailedAt && <span>per E-Mail verschickt</span>}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                  {href && (
                    <Link href={href} className="font-medium text-brand-700 underline">
                      Ansehen
                    </Link>
                  )}
                  {!compact && (
                    <form action={markNotificationRead}>
                      <input type="hidden" name="id" value={n.id} />
                      {!unread && <input type="hidden" name="unread" value="1" />}
                      <button className="text-brand-600 underline hover:text-brand-800">
                        {unread ? "Gelesen" : "Ungelesen"}
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
