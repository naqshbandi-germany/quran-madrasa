import { CourseTabs } from "./course-tabs";
import { formatCoursePeriod, requireManagedCourse } from "@/lib/course-manage";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Rahmen der Kursverwaltung: Kurstitel und Reiter (Teilnehmer, Sitzungen, Nachrichten,
// Einstellungen) ueber dem Inhalt des jeweiligen Reiters.
export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { course } = await requireManagedCourse(id);
  const [participants, unheard] = await Promise.all([
    prisma.enrollment.count({ where: { courseId: id } }),
    prisma.readingSample.count({ where: { courseId: id, listenedAt: null } }),
  ]);
  const period = formatCoursePeriod(course.startsOn, course.endsOn);

  return (
    <div className="space-y-6">
      <div>
        <p className="font-display text-3xl font-bold leading-tight text-azure-800">{course.title}</p>
        <p className="mt-1 text-sm text-brand-600">
          {course.isPublished ? "veröffentlicht" : "Entwurf"}
          {course.isHidden && " · versteckt"}
          {period && ` · Laufzeit ${period}`}
        </p>
      </div>
      <CourseTabs courseId={course.id} counts={{ participants, unheard }} />
      {children}
    </div>
  );
}
