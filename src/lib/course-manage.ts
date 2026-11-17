import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Zugriff auf die Kursverwaltung: Lehrkraefte nur auf ihre eigenen Kurse, Admins auf alle.
// Gibt sonst 404 zurueck (Teilnehmerdaten sollen nicht erratbar sein).
export async function requireManagedCourse(courseId: string) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) notFound();
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) notFound();
  const isAdmin = session.user.role === "ADMIN";
  if (!isAdmin && course.teacherId !== session.user.id) notFound();
  return { session, course, isAdmin };
}

// Anzeige in der Kursverwaltung: voller Name, dahinter der muslimische Name in Klammern,
// z. B. "Thomas Müller (Abdullah)".
export function nameWithMuslimName(person: { name: string; muslimName?: string | null }) {
  const muslim = person.muslimName?.trim();
  return muslim && muslim !== person.name ? `${person.name} (${muslim})` : person.name;
}

// Laufzeit, z. B. "01.02.2027 – 30.06.2027" oder "ab 01.02.2027".
export function formatCoursePeriod(startsOn: Date | null, endsOn: Date | null) {
  const f = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
  if (startsOn && endsOn) return `${f.format(startsOn)} – ${f.format(endsOn)}`;
  if (startsOn) return `ab ${f.format(startsOn)}`;
  if (endsOn) return `bis ${f.format(endsOn)}`;
  return null;
}
