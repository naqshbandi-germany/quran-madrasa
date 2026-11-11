import Link from "next/link";

import { randomBytes } from "node:crypto";

import { auth } from "@/auth";
import { CopyButton } from "@/components/copy-button";
import { getAppUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { formatAttendance, getProgressSummaries } from "@/lib/progress";
import { formatGermanDateTime } from "@/lib/schedule-time";

function formatGermanDate(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", dateStyle: "medium" }).format(date);
}

function formatDateTime(date: Date) {
  return `${formatGermanDateTime(date)} Uhr`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      participant: { select: { id: true, name: true } },
      course: {
        include: {
          sessions: {
            where: { startsAt: { gte: new Date() } },
            orderBy: { startsAt: "asc" },
            take: 3,
          },
        },
      },
    },
  });

  // Mehrere Teilnehmer desselben Kontos im selben Kurs zu einer Karte zusammenfassen.
  type CourseCard = {
    course: (typeof enrollments)[number]["course"];
    participants: { id: string; name: string }[];
  };
  const byCourse = new Map<string, CourseCard>();
  for (const { course, participant } of enrollments) {
    const entry = byCourse.get(course.id) ?? { course, participants: [] };
    entry.participants.push(participant);
    byCourse.set(course.id, entry);
  }

  // Pro Kurs: aktuelle Hausaufgabe (letzte vergangene Stunde mit Hausaufgabe) und Lernstand.
  const cards = await Promise.all(
    [...byCourse.values()].map(async (card) => {
      const [lastHomework, progress] = await Promise.all([
        prisma.classSession.findFirst({
          where: { courseId: card.course.id, startsAt: { lt: new Date() }, homework: { not: null } },
          orderBy: { startsAt: "desc" },
          select: { homework: true, startsAt: true },
        }),
        getProgressSummaries(
          card.course.id,
          card.participants.map((p) => p.id),
        ),
      ]);
      return { ...card, lastHomework, progress };
    }),
  );

  // Kalender-Abo: geheimer Schluessel wird beim ersten Besuch mit Kursen erzeugt.
  let calendarUrl: string | null = null;
  if (enrollments.length > 0) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { calendarToken: true },
    });
    const token =
      user.calendarToken ??
      (
        await prisma.user.update({
          where: { id: session.user.id },
          data: { calendarToken: randomBytes(24).toString("base64url") },
          select: { calendarToken: true },
        })
      ).calendarToken;
    calendarUrl = `${getAppUrl()}/api/kalender/${token}.ics`;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-azure-800">Meine Kurse</h1>
        <Link href="/dashboard/billing" className="text-sm font-medium text-brand-700 underline">
          Abo verwalten
        </Link>
      </div>

      {enrollments.length === 0 && (
        <p className="text-brand-600">
          Du bist noch in keinem Kurs eingeschrieben. Schau dir das{" "}
          <Link href="/" className="underline">
            Kursangebot
          </Link>{" "}
          an.
        </p>
      )}

      {calendarUrl && (
        <div className="border border-brand-200 bg-brand-50 p-4 text-sm">
          <h2 className="font-semibold text-azure-800">Termine im Kalender</h2>
          <p className="mt-1 text-brand-900/80">
            Abonniere deine Kurstermine im Handy- oder Computer-Kalender. Verschobene oder
            abgesagte Stunden werden dort automatisch aktualisiert.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a href={calendarUrl.replace(/^https?:/, "webcal:")} className="btn-primary px-3 py-1.5">
              Kalender abonnieren
            </a>
            <a href={calendarUrl} download className="underline">
              Als Datei herunterladen
            </a>
            <CopyButton text={calendarUrl} label="Link kopieren" />
          </div>
          <p className="mt-2 text-xs text-brand-600">
            Der Link ist persönlich. Bitte nicht weitergeben.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {cards.map(({ course, participants, lastHomework, progress }) => (
          <div key={course.id} className="border border-gold-400/40 bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold text-azure-800">{course.title}</h2>
              <Link href={`/dashboard/kurse/${course.id}`} className="text-sm font-medium text-brand-700 underline">
                Lernverlauf ansehen
              </Link>
            </div>
            <ul className="mt-1 space-y-0.5 text-sm text-brand-600">
              {participants.map((p) => {
                const s = progress.get(p.id);
                const details = s
                  ? [s.recorded > 0 && formatAttendance(s), s.position && `Stand: ${s.position}`].filter(Boolean)
                  : [];
                return (
                  <li key={p.id}>
                    <span className="font-medium text-brand-800">{p.name}</span>
                    {details.length > 0 && ` · ${details.join(" · ")}`}
                  </li>
                );
              })}
            </ul>
            {lastHomework?.homework && (
              <div className="mt-3 border-l-2 border-gold-400 bg-brand-50 px-3 py-2 text-sm">
                <p className="font-semibold text-azure-800">
                  Hausaufgabe vom {formatGermanDate(lastHomework.startsAt)}
                </p>
                <p className="whitespace-pre-line text-brand-900/85">{lastHomework.homework}</p>
              </div>
            )}
            {course.sessions.length === 0 ? (
              <p className="mt-2 text-sm text-brand-600">
                Noch keine kommenden Sitzungen geplant.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {course.sessions.map((classSession) => (
                  <li
                    key={classSession.id}
                    className="flex items-center justify-between bg-brand-50 px-3 py-2 text-sm"
                  >
                    <span>
                      {classSession.title} · {formatDateTime(classSession.startsAt)}
                    </span>
                    {classSession.joinUrl ? (
                      <Link
                        href={`/dashboard/classroom/${classSession.id}`}
                        className="btn-primary btn-display px-3 py-1"
                      >
                        Klasse beitreten
                      </Link>
                    ) : (
                      <span className="text-brand-400">Link folgt</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
