import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: {
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand-700">Meine Kurse</h1>
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
        {enrollments.map(({ course }) => (
          <div key={course.id} className="rounded-lg border border-brand-200 bg-white p-5">
            <h2 className="font-semibold text-brand-700">{course.title}</h2>
            {course.sessions.length === 0 ? (
              <p className="mt-2 text-sm text-brand-600">
                Noch keine kommenden Sitzungen geplant.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {course.sessions.map((classSession) => (
                  <li
                    key={classSession.id}
                    className="flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-sm"
                  >
                    <span>
                      {classSession.title} · {formatDateTime(classSession.startsAt)}
                    </span>
                    {classSession.joinUrl ? (
                      <Link
                        href={`/dashboard/classroom/${classSession.id}`}
                        className="rounded-md bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700"
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
