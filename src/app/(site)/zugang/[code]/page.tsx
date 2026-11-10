import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canAccessCourse } from "@/lib/course-access";
import { prisma } from "@/lib/prisma";
import { CourseDetail, courseDetailInclude } from "../../courses/[slug]/course-detail";

// Geheimer Link zu einem versteckten Kurs (z. B. Testphase). Nicht zwischenspeichern und nicht
// von Suchmaschinen aufnehmen lassen.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function HiddenCoursePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const course = await prisma.course.findUnique({
    where: { accessCode: code },
    include: courseDetailInclude,
  });
  if (!course || !course.isHidden || !canAccessCourse(course, code)) notFound();

  return <CourseDetail course={course} />;
}
