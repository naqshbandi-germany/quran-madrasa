import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { AGE_GROUP_LABELS, WEEKDAY_LABELS } from "../../course-catalog";
import { SubscribeButton } from "./subscribe-button";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      teacher: { select: { name: true } },
      scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
    },
  });

  if (!course || !course.isPublished) {
    notFound();
  }

  return (
    <article className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">
            {course.category}
          </span>
          {course.level && (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700">
              {course.level}
            </span>
          )}
          {course.ageGroups.map((ag) => (
            <span
              key={ag}
              className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800"
            >
              {AGE_GROUP_LABELS[ag] ?? ag}
            </span>
          ))}
        </div>
        <h1 className="mt-2 text-3xl font-bold text-brand-700">{course.title}</h1>
        <p className="mt-1 text-brand-600">Lehrer: {course.teacher.name}</p>
      </div>

      <p className="text-brand-900">{course.description}</p>

      {course.scheduleSlots.length > 0 && (
        <div>
          <h2 className="font-semibold text-brand-700">Wöchentlicher Unterricht</h2>
          <ul className="mt-2 space-y-1 text-sm text-brand-900">
            {course.scheduleSlots.map((slot) => (
              <li key={slot.id}>
                {WEEKDAY_LABELS[slot.weekday] ?? slot.weekday}: {slot.startTime}–{slot.endTime}
                {slot.note ? ` (${slot.note})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-brand-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-brand-700">
              {formatPrice(course.priceCents, course.currency)}
              <span className="text-base font-normal text-brand-600"> / Monat</span>
            </p>
            <p className="text-sm text-brand-600">Monatlich kündbar, keine Mindestlaufzeit</p>
          </div>
          <SubscribeButton courseId={course.id} slug={course.slug} />
        </div>
      </div>
    </article>
  );
}
