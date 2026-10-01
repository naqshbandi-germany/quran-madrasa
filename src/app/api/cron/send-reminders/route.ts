import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { reminderHtml, reminderSubject } from "@/lib/reminder-email";
import { EMAIL_FROM, resend } from "@/lib/resend";
import { getAppUrl } from "@/lib/app-url";

export const maxDuration = 60;

// Wird alle 15 Minuten von einem GitHub-Actions-Workflow aufgerufen (siehe
// .github/workflows/send-reminders.yml) - Vercels Hobby-Plan erlaubt Cron Jobs
// nur einmal taeglich, daher dieser externe Taktgeber.
//
// Zeitfenster von +/-20 Minuten um die eigentliche 24h/1h-Marke herum, damit
// weder Timing-Ungenauigkeiten des Schedulers noch knapp verpasste
// Durchlaeufe eine Sitzung durchrutschen lassen. reminder24hSentAt/
// reminder1hSentAt verhindern doppelten Versand bei jedem Durchlauf.
async function findDueSessions(hoursBefore: number, field: "reminder24hSentAt" | "reminder1hSentAt") {
  const target = new Date(Date.now() + hoursBefore * 60 * 60 * 1000);
  const windowMs = 20 * 60 * 1000;

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
  kind: "24h" | "1h",
  field: "reminder24hSentAt" | "reminder1hSentAt",
) {
  const appUrl = getAppUrl();
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

  const sessions24h = await findDueSessions(24, "reminder24hSentAt");
  const sent24h = await sendRemindersFor(sessions24h, "24h", "reminder24hSentAt");

  const sessions1h = await findDueSessions(1, "reminder1hSentAt");
  const sent1h = await sendRemindersFor(sessions1h, "1h", "reminder1hSentAt");

  return NextResponse.json({
    sessions24h: sessions24h.length,
    sessions1h: sessions1h.length,
    emailsSent: sent24h + sent1h,
  });
}
