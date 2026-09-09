import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { SubscribeButton } from "./subscribe-button";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const course = await prisma.course.findUnique({
    where: { slug: params.slug },
    include: { teacher: { select: { name: true } } },
  });

  if (!course || !course.isPublished) {
    notFound();
  }

  return (
    <article className="space-y-6">
      <div>
        <p className="text-sm font-medium text-brand-400">{course.category}</p>
        <h1 className="text-3xl font-bold text-brand-700">{course.title}</h1>
        <p className="mt-1 text-brand-600">Lehrer: {course.teacher.name}</p>
      </div>

      <p className="text-brand-900">{course.description}</p>

      <div className="rounded-lg border border-brand-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-brand-700">
              {formatPrice(course.priceCents, course.currency)}
              <span className="text-base font-normal text-brand-600"> / Monat</span>
            </p>
            <p className="text-sm text-brand-600">Monatlich kündbar, keine Mindestlaufzeit</p>
          </div>
          <SubscribeButton courseId={course.id} />
        </div>
      </div>
    </article>
  );
}
