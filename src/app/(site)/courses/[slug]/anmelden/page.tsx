import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { EnrollWizard } from "./enroll-wizard";

export const metadata = { title: "Zum Kurs anmelden – Quran Madrasa" };

// Hängt von der Anmeldung ab und darf nicht zwischengespeichert werden.
export const dynamic = "force-dynamic";

export default async function EnrollPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course || !course.isPublished) notFound();
  if (!course.stripePriceId) redirect(`/courses/${slug}`);

  const session = await auth();
  if (!session) {
    redirect(`/auth/signup?callbackUrl=${encodeURIComponent(`/courses/${slug}/anmelden`)}`);
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
      }}
      account={{ name: user.name, email: user.email }}
      participants={participants.map((p) => ({
        id: p.id,
        name: p.name,
        relation: p.relation,
        birthYear: p.birthYear,
        enrolled: p.enrollments.length > 0,
      }))}
    />
  );
}
