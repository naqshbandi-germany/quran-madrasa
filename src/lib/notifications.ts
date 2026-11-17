import { Prisma, type NotificationType } from "@prisma/client";

import { getAppUrl } from "@/lib/app-url";
import { buildEmail } from "@/lib/email-templates";
import {
  NOTIFICATION_TYPE_INFO,
  describeEvent,
  eventHref,
  type EventData,
} from "@/lib/notification-types";
import { callName, fullName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { deliverEmail, EMAIL_FROM } from "@/lib/resend";

// Zentrale Stelle fuer Ereignisse: speichert das Ereignis, legt pro Empfaenger eine
// Benachrichtigung an und verschickt eine E-Mail an alle, die das fuer diesen Typ wuenschen.
// Wirft nie: Ein Fehler hier darf Webhook, Anmeldung oder Upload nicht abbrechen.

type RecordEventInput = {
  type: NotificationType;
  // Eindeutig pro Ereignis, z. B. "enrollment:<id>". Ein zweiter Aufruf mit demselben
  // Schluessel (Stripe schickt Ereignisse mehrfach) wird ignoriert.
  dedupeKey: string;
  courseId?: string | null;
  participantId?: string | null;
  data: EventData;
};

// Wer ein Ereignis bekommt: Kurs-Ereignisse die Lehrkraft des Kurses, Zahlungsprobleme die
// Admins. Sollen Admins spaeter weitere Ereignisse bekommen, nur hier ergaenzen.
async function recipientsFor(type: NotificationType, courseId: string | null | undefined) {
  if (NOTIFICATION_TYPE_INFO[type].audience === "admins") {
    return prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true, name: true, muslimName: true, email: true, role: true } });
  }
  if (!courseId) return [];
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { teacher: { select: { id: true, name: true, muslimName: true, email: true, role: true } } },
  });
  return course ? [course.teacher] : [];
}

export async function emailWanted(userId: string, type: NotificationType) {
  const pref = await prisma.notificationPreference.findUnique({ where: { userId_type: { userId, type } } });
  return pref ? pref.email : NOTIFICATION_TYPE_INFO[type].emailByDefault;
}

export function notificationsBasePath(role: string) {
  return role === "ADMIN" ? "/admin/benachrichtigungen" : "/teacher/benachrichtigungen";
}

export async function recordEvent(input: RecordEventInput) {
  try {
    let event;
    try {
      event = await prisma.activityEvent.create({
        data: {
          type: input.type,
          dedupeKey: input.dedupeKey,
          courseId: input.courseId ?? null,
          participantId: input.participantId ?? null,
          data: input.data as Prisma.InputJsonValue,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
      throw err;
    }

    const recipients = await recipientsFor(input.type, input.courseId);
    if (recipients.length === 0) return;
    await prisma.notification.createMany({
      data: recipients.map((r) => ({ eventId: event.id, userId: r.id })),
      skipDuplicates: true,
    });

    const { title, detail } = describeEvent(input.type, input.data);
    const appUrl = getAppUrl();
    const href = eventHref(input.type, input.courseId ?? null, input.data);

    for (const recipient of recipients) {
      if (!(await emailWanted(recipient.id, input.type))) continue;
      const base = notificationsBasePath(recipient.role);
      try {
        await deliverEmail({
          from: EMAIL_FROM,
          to: recipient.email,
          ...(await buildEmail("staff_notification", {
            name: callName(recipient),
            titel: title,
            details: detail,
            link: `${appUrl}${href ?? base}`,
            einstellungen: `${appUrl}${base}/einstellungen`,
          })),
        });
        await prisma.notification.update({
          where: { eventId_userId: { eventId: event.id, userId: recipient.id } },
          data: { emailedAt: new Date() },
        });
      } catch (err) {
        console.error(`Benachrichtigung "${title}" an ${recipient.email} fehlgeschlagen:`, err);
      }
    }
  } catch (err) {
    console.error(`Ereignis ${input.type} (${input.dedupeKey}) konnte nicht gespeichert werden:`, err);
  }
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
