import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { REVIEW_SAMPLE_SELECT, ReadingSampleReviewList } from "@/components/reading-sample-review-list";
import { prisma } from "@/lib/prisma";
import { READING_SAMPLE_RETENTION_DAYS } from "@/lib/reading-samples";

export default async function TeacherReadingSamplesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id }, select: { id: true, title: true, teacherId: true } });
  if (!course) notFound();
  const session = await auth();
  if (session?.user.role !== "ADMIN" && session?.user.id !== course.teacherId) notFound();

  const samples = await prisma.readingSample.findMany({
    where: { courseId: id },
    // Ungehoerte zuerst, darin die neuesten oben.
    orderBy: [{ listenedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    select: REVIEW_SAMPLE_SELECT,
  });
  const unheard = samples.filter((s) => !s.listenedAt).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/teacher/courses/${id}`} className="text-sm text-brand-700 underline">
          ← {course.title}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-azure-800">Leseproben</h1>
        <p className="text-sm text-brand-600">
          {unheard > 0 ? `${unheard} noch nicht gehört. ` : ""}
          Nur du und der Admin können die Aufnahmen hören, andere Teilnehmer nicht. Sie werden nach{" "}
          {Math.round(READING_SAMPLE_RETENTION_DAYS / 30)} Monaten automatisch gelöscht. Um eine
          Leseprobe zu bitten, trage bei einer Sitzung unter &bdquo;Inhalt &amp; Hausaufgabe&ldquo; den
          Abschnitt ein.
        </p>
      </div>
      <ReadingSampleReviewList samples={samples} />
    </div>
  );
}
