import { Prisma, type NotificationType } from "@prisma/client";

import { getAppUrl } from "@/lib/app-url";
import { buildEmail } from "@/lib/email-templates";
import {
  NOTIFICATION_TYPE_INFO,
  describeEvent,
  eventHref,
  eventParticipants,
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

// Wer ein Ereignis bekommt: Admins alle, die Lehrkraft die Ereignisse ihres Kurses.
// wantsEmail = false: nur im Feed, unabhaengig von den Einstellungen pro Ereignistyp (Admins bei
// Kursen anderer Lehrkraefte, solange sie das nicht einschalten).
async function recipientsFor(type: NotificationType, courseId: string | null | undefined) {
  const select = { id: true, name: true, muslimName: true, email: true, role: true, notifyAllCourses: true } as const;
  const adminsOnly = NOTIFICATION_TYPE_INFO[type].audience === "admins";
  const [admins, course] = await Promise.all([
    prisma.user.findMany({ where: { role: "ADMIN" }, select }),
    !adminsOnly && courseId
      ? prisma.course.findUnique({ where: { id: courseId }, select: { teacher: { select } } })
      : null,
  ]);
  const teacher = course?.teacher;
  return [
    ...(teacher ? [{ ...teacher, wantsEmail: true }] : []),
    ...admins
      .filter((admin) => admin.id !== teacher?.id)
      .map((admin) => ({ ...admin, wantsEmail: adminsOnly || admin.notifyAllCourses })),
  ];
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
    const people = eventParticipants(input.participantId ?? null, input.data);
    const href = eventHref(input.type, input.courseId ?? null, input.data, people.length === 1 ? people[0].id : null);

    for (const recipient of recipients) {
      if (!recipient.wantsEmail || !(await emailWanted(recipient.id, input.type))) continue;
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

// Einschreibungen als Ereignis "Neuer Schüler angemeldet" melden (kostenlose Einladung usw.).
export async function recordEnrollments(courseId: string, enrollmentIds: string[]) {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { id: { in: enrollmentIds } },
      orderBy: { createdAt: "asc" },
      select: {
        participantId: true,
        participant: { select: { name: true, muslimName: true } },
        user: { select: { name: true } },
        course: { select: { title: true } },
      },
    });
    if (enrollments.length === 0) return;
    await recordEvent({
      type: "ENROLLMENT_CREATED",
      dedupeKey: `enrollment:${[...enrollmentIds].sort().join(",")}`,
      courseId,
      participantId: enrollments.length === 1 ? enrollments[0].participantId : null,
      data: {
        course: enrollments[0].course.title,
        owner: enrollments[0].user.name,
        participants: enrollments.map((e) => fullName(e.participant)),
        participantIds: enrollments.map((e) => e.participantId),
      },
    });
  } catch (err) {
    console.error("Ereignis zur Anmeldung konnte nicht gespeichert werden:", err);
  }
}

// Bisherige Ereignisse eines Kurses fuer die neue Lehrkraft sichtbar machen (Kurs uebertragen).
export async function copyCourseNotifications(courseId: string, teacherId: string) {
  try {
    const events = await prisma.activityEvent.findMany({
      where: { courseId, type: { not: "PAYMENT_FAILED" } },
      select: { id: true, createdAt: true },
    });
    await prisma.notification.createMany({
      data: events.map((e) => ({ eventId: e.id, userId: teacherId, createdAt: e.createdAt, readAt: new Date() })),
      skipDuplicates: true,
    });
  } catch (err) {
    console.error(`Ereignisse des Kurses ${courseId} konnten nicht übertragen werden:`, err);
  }
}

export async function countUnreadNotifications(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
