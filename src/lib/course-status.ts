// Zustand eines Kurses: Entwurf (nur fuer das Team sichtbar) -> Anmeldung offen (veroeffentlicht,
// buchbar, Serien stehen im Stundenplan) -> Laeuft ("Kurs starten": Stunden mit Meeting-Link und
// Erinnerungen). Ein laufender Kurs bleibt buchbar, solange er veroeffentlicht ist.

export type CourseStatus = "DRAFT" | "OPEN" | "RUNNING";

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  DRAFT: "Entwurf",
  OPEN: "Anmeldung offen",
  RUNNING: "Läuft",
};

export function courseStatus(course: { isPublished: boolean; startedAt: Date | null }): CourseStatus {
  if (course.startedAt) return "RUNNING";
  return course.isPublished ? "OPEN" : "DRAFT";
}

// Text fuer Abzeichen und Listen, z. B. "Läuft · nicht buchbar" fuer einen laufenden Kurs, der
// auf Entwurf gesetzt wurde.
export function courseStatusText(course: { isPublished: boolean; startedAt: Date | null; isHidden?: boolean }) {
  const status = courseStatus(course);
  const parts = [COURSE_STATUS_LABELS[status]];
  if (status === "RUNNING" && !course.isPublished) parts.push("nicht buchbar");
  if (course.isHidden) parts.push("versteckt");
  return parts.join(" · ");
}

export const COURSE_STATUS_CLASSES: Record<CourseStatus, string> = {
  DRAFT: "bg-brand-100 text-brand-700",
  OPEN: "bg-gold-200 text-brand-900",
  RUNNING: "bg-green-50 text-green-900 ring-1 ring-green-700/30",
};
