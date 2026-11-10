import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { CourseDetail, courseDetailInclude } from "./course-detail";

// Die angezeigten Unterrichtszeiten haengen von der deutschen Sommer-/Winterzeit
// ab, daher stuendlich neu erzeugen.
export const revalidate = 3600;

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await prisma.course.findUnique({ where: { slug }, include: courseDetailInclude });

  // Versteckte Kurse sind nur ueber ihren geheimen Link /zugang/<code> erreichbar.
  if (!course || !course.isPublished || course.isHidden) {
    notFound();
  }

  return <CourseDetail course={course} />;
}
