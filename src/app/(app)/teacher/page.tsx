import Link from "next/link";

import { auth } from "@/auth";
import { NotificationsFeed } from "@/components/notifications-feed";
import { prisma } from "@/lib/prisma";
import { CourseStatusBadge } from "@/components/course-status-badge";

export const dynamic = "force-dynamic";

// Startseite des Lehrer-Bereichs: neueste Benachrichtigungen und Schnellzugriff auf die Kurse.
// Die vollstaendige Kursliste steht unter "Kurse" (/teacher/kurse).
export default async function TeacherPage() {
  const session = await auth();
  if (!session) return null;

  const courses = await prisma.course.findMany({
    where: { teacherId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { enrollments: true } } },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-azure-800">Übersicht</h1>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-azure-800">Neueste Benachrichtigungen</h2>
          <Link href="/teacher/benachrichtigungen" className="text-sm font-medium text-brand-700 underline">
            Alle ansehen
          </Link>
        </div>
        <NotificationsFeed
          userId={session.user.id}
          role={session.user.role}
          basePath="/teacher/benachrichtigungen"
          compact
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-azure-800">Deine Kurse</h2>
          <Link href="/teacher/kurse" className="text-sm font-medium text-brand-700 underline">
            Alle Kurse
          </Link>
        </div>
        {courses.length === 0 ? (
          <p className="border border-brand-200 bg-white p-4 text-sm text-brand-600">
            Noch keine Kurse. Unter „Kurse“ legst du einen neuen Kurs an.
          </p>
        ) : (
          <ul className="divide-y divide-brand-200 border border-brand-200 bg-white">
            {courses.map((course) => (
              <li key={course.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium text-brand-700">{course.title}</p>
                  <p className="text-sm text-brand-600">
                    <CourseStatusBadge course={course} /> {course._count.enrollments} eingeschriebene Schüler
                  </p>
                </div>
                <Link href={`/teacher/courses/${course.id}`} className="text-sm font-medium text-brand-700 underline">
                  Verwalten
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
