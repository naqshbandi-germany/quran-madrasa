import { NextResponse } from "next/server";

import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { reminderHtml, reminderSubject, type ReminderKind } from "@/lib/reminder-email";
import { EMAIL_FROM, getResend } from "@/lib/resend";

export const maxDuration = 60;

type ReminderField = "reminder24hSentAt" | "reminder1hSentAt" | "reminderStartSentAt";

// Wird alle 15 Minuten von einem GitHub-Actions-Workflow aufgerufen (siehe
// .github/workflows/send-reminders.yml) - Vercels Hobby-Plan erlaubt Cron Jobs
// nur einmal taeglich, daher dieser externe Taktgeber.
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
          enrollments: { include: { user: { select: { id: true, name: true, email: true } } } },
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
  const resend = getResend();
  let emailCount = 0;

  for (const classSession of sessions) {
    const joinUrl = `${appUrl}/dashboard/classroom/${classSession.id}`;

    for (const enrollment of classSession.course.enrollments) {
      const { user } = enrollment;
      try {
        await resend.emails.send({
          from: EMAIL_FROM,
          to: user.email,
          subject: reminderSubject(classSession.course.title, kind),
          html: reminderHtml({
            studentName: user.name,
            courseTitle: classSession.course.title,
            startsAt: classSession.startsAt,
            joinUrl,
            kind,
          }),
        });
        emailCount++;
      } catch (err) {
        console.error(`Reminder-E-Mail (${kind}) an ${user.email} fehlgeschlagen:`, err);
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
