import { NextResponse } from "next/server";

import { getAppUrl } from "@/lib/app-url";
import { groupRecipients } from "@/lib/enrollment-recipients";
import { prisma } from "@/lib/prisma";
import { emailRenderer } from "@/lib/email-templates";
import { formatReminderDate, REMINDER_TEMPLATES, type ReminderKind } from "@/lib/reminder-email";
import { EMAIL_FROM, deliverEmail } from "@/lib/resend";

export const maxDuration = 60;

type ReminderField = "reminder24hSentAt" | "reminder1hSentAt" | "reminderStartSentAt";

// Wird alle 15 Minuten von einem externen Taktgeber aufgerufen (cron-job.org, siehe README;
// als Rueckfall auch .github/workflows/send-reminders.yml) - Vercels Hobby-Plan erlaubt Cron
// Jobs nur einmal taeglich. Doppelte Aufrufe sind unschaedlich (reminder*SentAt).
//
// Zeitfenster um die eigentliche Marke herum, damit weder Timing-
// Ungenauigkeiten des Schedulers noch knapp verpasste Durchlaeufe eine
// Sitzung durchrutschen lassen. Bei "jetzt live" ist das Fenster enger, damit
// die Mail nicht erst 15+ Minuten nach Kursbeginn ankommt.
// reminder24hSentAt/reminder1hSentAt/reminderStartSentAt verhindern
// doppelten Versand bei jedem Durchlauf.
async function findDueSessions(minutesBefore: number, windowMinutes: number, field: ReminderField) {
  const target = new Date(Date.now() + minutesBefore * 60 * 1000);
  const windowMs = windowMinutes * 60 * 1000;

  return prisma.classSession.findMany({
    where: {
      startsAt: { gte: new Date(target.getTime() - windowMs), lte: new Date(target.getTime() + windowMs) },
      [field]: null,
      joinUrl: { not: null },
    },
    include: {
      course: {
        include: {
          enrollments: {
            include: {
              user: { select: { name: true, email: true } },
              participant: { select: { name: true, email: true } },
            },
          },
        },
      },
    },
  });
}

async function sendRemindersFor(
  sessions: Awaited<ReturnType<typeof findDueSessions>>,
  kind: ReminderKind,
  field: ReminderField,
) {
  const appUrl = getAppUrl();
  const render = await emailRenderer(REMINDER_TEMPLATES[kind]);
  let emailCount = 0;

  for (const classSession of sessions) {
    const joinUrl = `${appUrl}/dashboard/classroom/${classSession.id}`;

    for (const recipient of groupRecipients(classSession.course.enrollments)) {
      try {
        await deliverEmail({
          from: EMAIL_FROM,
          to: recipient.email,
          ...render({
            name: recipient.greetingName,
            kurs: classSession.course.title,
            datum: formatReminderDate(classSession.startsAt),
            link: joinUrl,
          }),
        });
        emailCount++;
      } catch (err) {
        console.error(`Reminder-E-Mail (${kind}) an ${recipient.email} fehlgeschlagen:`, err);
      }
    }

    await prisma.classSession.update({
      where: { id: classSession.id },
      data: { [field]: new Date() },
    });
  }

  return emailCount;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Nicht autorisiert." }, { status: 401 });
  }

  // Fuer die Ueberwachung im Admin-Bereich: wann der Taktgeber zuletzt angeklopft hat.
  await prisma.siteContent.upsert({
    where: { id: "main" },
    create: { id: "main", remindersLastRunAt: new Date() },
    update: { remindersLastRunAt: new Date() },
  });

  const sessions24h = await findDueSessions(24 * 60, 20, "reminder24hSentAt");
  const sent24h = await sendRemindersFor(sessions24h, "24h", "reminder24hSentAt");

  const sessions1h = await findDueSessions(60, 20, "reminder1hSentAt");
  const sent1h = await sendRemindersFor(sessions1h, "1h", "reminder1hSentAt");

  const sessionsStart = await findDueSessions(0, 8, "reminderStartSentAt");
  const sentStart = await sendRemindersFor(sessionsStart, "start", "reminderStartSentAt");

  return NextResponse.json({
    sessions24h: sessions24h.length,
    sessions1h: sessions1h.length,
    sessionsStart: sessionsStart.length,
    emailsSent: sent24h + sent1h + sentStart,
  });
}
