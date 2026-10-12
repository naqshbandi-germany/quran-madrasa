import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatGermanDateTime } from "@/lib/schedule-time";

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
      participant: { select: { name: true } },
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
  const byCourse = new Map<string, { course: (typeof enrollments)[number]["course"]; names: string[] }>();
  for (const { course, participant } of enrollments) {
    const entry = byCourse.get(course.id) ?? { course, names: [] };
    entry.names.push(participant.name);
    byCourse.set(course.id, entry);
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

      <div className="space-y-6">
        {[...byCourse.values()].map(({ course, names }) => (
          <div key={course.id} className="border border-gold-400/40 bg-white p-5">
            <h2 className="font-semibold text-azure-800">{course.title}</h2>
            <p className="mt-1 text-sm text-brand-600">Teilnehmer: {names.join(", ")}</p>
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
