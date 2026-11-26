import { COURSE_STATUS_CLASSES, courseStatus, courseStatusText } from "@/lib/course-status";

// Zustand eines Kurses als kleines Abzeichen (Kursliste, Kurs-Kopf, Uebersicht).
export function CourseStatusBadge({
  course,
}: {
  course: { isPublished: boolean; startedAt: Date | null; isHidden?: boolean };
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap px-2 py-0.5 text-xs font-medium ${COURSE_STATUS_CLASSES[courseStatus(course)]}`}
    >
      {courseStatusText(course)}
    </span>
  );
}
