import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { accessQuery, canAccessCourse } from "@/lib/course-access";
import { getCourseCapacity } from "@/lib/course-capacity";
import { enrollPathForInvitation, findValidInvitation } from "@/lib/invitations";
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
  searchParams: Promise<{ zugang?: string | string[]; einladung?: string | string[] }>;
}) {
  const { slug } = await params;
  const { zugang, einladung } = await searchParams;
  const code = typeof zugang === "string" ? zugang : null;
  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course || !canAccessCourse(course, code)) notFound();

  // Einladung ("ohne Zahlung" nur, wenn sie zu diesem Kurs gehoert und noch gilt).
  const token = typeof einladung === "string" ? einladung : null;
  const invitation = token ? await findValidInvitation(token) : null;
  const freeInvitation = invitation && invitation.courseId === course.id && invitation.freeEnrollment ? token : null;

  // Zurueck zur Kursseite: bei versteckten Kursen ueber den geheimen Link.
  const coursePath = course.isHidden ? `/zugang/${course.accessCode}` : `/courses/${slug}`;
  if (!course.stripePriceId && !freeInvitation) redirect(coursePath);
  const capacity = await getCourseCapacity(course.id, course.maxParticipants);
  if (capacity.isFull) redirect(coursePath);

  const session = await auth();
  if (!session) {
    const back = token ? enrollPathForInvitation(course, token) : `/courses/${slug}/anmelden${accessQuery(course)}`;
    redirect(`/auth/signup?callbackUrl=${encodeURIComponent(back)}`);
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
      freeInvitationToken={freeInvitation}
    />
  );
}
