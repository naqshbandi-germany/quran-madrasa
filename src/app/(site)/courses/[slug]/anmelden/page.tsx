import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { accessQuery, canAccessCourse } from "@/lib/course-access";
import { getCourseCapacity } from "@/lib/course-capacity";
import { prisma } from "@/lib/prisma";
import { EnrollWizard } from "./enroll-wizard";

export const metadata = { title: "Zum Kurs anmelden" };

// Hängt von der Anmeldung ab und darf nicht zwischengespeichert werden.
export const dynamic = "force-dynamic";

export default async function EnrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ zugang?: string | string[] }>;
}) {
  const { slug } = await params;
  const { zugang } = await searchParams;
  const code = typeof zugang === "string" ? zugang : null;
  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course || !canAccessCourse(course, code)) notFound();
  // Zurueck zur Kursseite: bei versteckten Kursen ueber den geheimen Link.
  const coursePath = course.isHidden ? `/zugang/${course.accessCode}` : `/courses/${slug}`;
  if (!course.stripePriceId) redirect(coursePath);
  const capacity = await getCourseCapacity(course.id, course.maxParticipants);
  if (capacity.isFull) redirect(coursePath);

  const session = await auth();
  if (!session) {
    redirect(
      `/auth/signup?callbackUrl=${encodeURIComponent(`/courses/${slug}/anmelden${accessQuery(course)}`)}`,
    );
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const participants = await prisma.participant.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    include: { enrollments: { where: { courseId: course.id }, select: { id: true } } },
  });

  return (
    <EnrollWizard
      course={{
        id: course.id,
        slug: course.slug,
        title: course.title,
        priceCents: course.priceCents,
        currency: course.currency,
        signupFeeCents: course.signupFeeCents,
        accessCode: course.isHidden ? course.accessCode : null,
      }}
      account={{ name: user.name, email: user.email }}
      participants={participants.map((p) => ({
        id: p.id,
        name: p.name,
        relation: p.relation,
        birthYear: p.birthYear,
        enrolled: p.enrollments.length > 0,
      }))}
      freePlaces={capacity.free}
    />
  );
}
