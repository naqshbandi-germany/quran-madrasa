import { getAppUrl } from "@/lib/app-url";
import { createClassroomMeeting } from "@/lib/classroom";
import { buildEmail, emailRenderer } from "@/lib/email-templates";
import { buildCalendar } from "@/lib/ics";
import { prisma } from "@/lib/prisma";
import { formatReminderDate } from "@/lib/reminder-email";
import { deliverEmail, EMAIL_FROM } from "@/lib/resend";
import { deleteZoomMeeting } from "@/lib/zoom";

// Probestunden: ein Termin zu einem Kurs, zu dem eine oder mehrere Personen ohne Konto
// eingeladen werden. Die Gaeste bekommen den Link zum Unterrichtsraum direkt per E-Mail.

export const TRIAL_DURATIONS = [30, 45, 60] as const;

export type TrialGuestInput = { name: string; email: string };

function calendarFor(trial: { id: string; startsAt: Date; durationMin: number; joinUrl: string }, courseTitle: string) {
  const host = new URL(getAppUrl()).host;
  return buildCalendar(`Probestunde ${courseTitle}`, host, [
    {
      id: `probestunde-${trial.id}`,
      title: `Probestunde: ${courseTitle}`,
      courseTitle,
      startsAt: trial.startsAt,
      durationMin: trial.durationMin,
      url: trial.joinUrl,
    },
  ]);
}

// Legt die Probestunde mit Unterrichtsraum an und laedt alle Gaeste ein. Bei "mail" geht eine
// E-Mail mit Kalendereintrag raus; bei "link" nur der fertige Text zum Weiterschicken.
export async function createTrialLesson(params: {
  courseId: string;
  createdById: string;
  startsAt: Date;
  durationMin: number;
  guests: TrialGuestInput[];
  delivery: "mail" | "link";
}) {
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: params.courseId },
    include: { teacher: { select: { name: true, zoomEmail: true } } },
  });
  const meeting = await createClassroomMeeting({
    courseSlug: `${course.slug}-probestunde`,
    title: `Probestunde: ${course.title}`,
    startsAt: params.startsAt,
    durationMin: params.durationMin,
    teacherZoomEmail: course.teacher.zoomEmail,
  });

  const trial = await prisma.trialLesson.create({
    data: {
      courseId: course.id,
      createdById: params.createdById,
      startsAt: params.startsAt,
      durationMin: params.durationMin,
      classroomType: meeting.classroomType,
      joinUrl: meeting.joinUrl,
      zoomMeetingId: meeting.zoomMeetingId,
      guests: { create: params.guests.map((g) => ({ name: g.name, email: g.email })) },
    },
  });

  const datum = formatReminderDate(trial.startsAt);
  const results: { name: string; email: string; ok: boolean; mailed: boolean; shareText: string }[] = [];
  const render = params.delivery === "mail" ? await emailRenderer("trial_invite") : null;
  const ics = calendarFor(trial, course.title);

  for (const guest of params.guests) {
    const shareText = `Salam alaykum ${guest.name}, du bist herzlich zu einer kostenlosen Probestunde im Kurs „${course.title}“ bei ${course.teacher.name} eingeladen: ${datum}, ${trial.durationMin} Minuten. Hier ist der Link, ein Konto brauchst du nicht: ${trial.joinUrl}`;
    if (!render || !guest.email) {
      results.push({ ...guest, ok: true, mailed: false, shareText });
      continue;
    }
    try {
      await deliverEmail({
        from: EMAIL_FROM,
        to: guest.email,
        ...render({
          name: guest.name,
          kurs: course.title,
          lehrer: course.teacher.name,
          datum,
          dauer: String(trial.durationMin),
          link: trial.joinUrl,
        }),
        attachments: [{ filename: "probestunde.ics", content: Buffer.from(ics, "utf-8") }],
      });
      results.push({ ...guest, ok: true, mailed: Boolean(process.env.RESEND_API_KEY), shareText });
    } catch (err) {
      console.error(`Einladung zur Probestunde an ${guest.email} fehlgeschlagen:`, err);
      results.push({ ...guest, ok: false, mailed: false, shareText });
    }
  }

  return { trial, course, results };
}

// Probestunde absagen: Zoom-Meeting loeschen (falls vorhanden) und alle Gaeste informieren.
export async function cancelTrialLesson(trialId: string) {
  const trial = await prisma.trialLesson.findUnique({
    where: { id: trialId },
    include: { guests: true, course: { select: { title: true } } },
  });
  if (!trial || trial.canceledAt) return;
  await prisma.trialLesson.update({ where: { id: trial.id }, data: { canceledAt: new Date() } });
  if (trial.zoomMeetingId) {
    await deleteZoomMeeting(trial.zoomMeetingId).catch((err) =>
      console.error("Zoom-Meeting der Probestunde konnte nicht gelöscht werden:", err),
    );
  }
  if (trial.startsAt.getTime() < Date.now()) return;
  for (const guest of trial.guests) {
    if (!guest.email) continue;
    try {
      await deliverEmail({
        from: EMAIL_FROM,
        to: guest.email,
        ...(await buildEmail("trial_cancelled", {
          name: guest.name,
          kurs: trial.course.title,
          datum: formatReminderDate(trial.startsAt),
        })),
      });
    } catch (err) {
      console.error(`Absage der Probestunde an ${guest.email} fehlgeschlagen:`, err);
    }
  }
}

type TrialReminderField = "reminder24hSentAt" | "reminder1hSentAt";

// Erinnerungen fuer den Cron (alle 15 Minuten): 24 Stunden und 1 Stunde vorher.
export async function sendTrialReminders(minutesBefore: number, windowMinutes: number, field: TrialReminderField) {
  const target = Date.now() + minutesBefore * 60_000;
  const trials = await prisma.trialLesson.findMany({
    where: {
      canceledAt: null,
      [field]: null,
      startsAt: { gte: new Date(target - windowMinutes * 60_000), lte: new Date(target + windowMinutes * 60_000) },
    },
    include: { guests: true, course: { select: { title: true } } },
  });
  const render = await emailRenderer("trial_reminder");
  let sent = 0;
  for (const trial of trials) {
    // Gaeste ohne E-Mail-Adresse (per WhatsApp eingeladen) bekommen keine Erinnerung.
    for (const guest of trial.guests.filter((g) => g.email)) {
      try {
        await deliverEmail({
          from: EMAIL_FROM,
          to: guest.email,
          ...render({
            name: guest.name,
            kurs: trial.course.title,
            wann: field === "reminder24hSentAt" ? "morgen" : "in einer Stunde",
            datum: formatReminderDate(trial.startsAt),
            link: trial.joinUrl,
          }),
        });
        sent++;
      } catch (err) {
        console.error(`Erinnerung an die Probestunde (${guest.email}) fehlgeschlagen:`, err);
      }
    }
    await prisma.trialLesson.update({ where: { id: trial.id }, data: { [field]: new Date() } });
  }
  return sent;
}
