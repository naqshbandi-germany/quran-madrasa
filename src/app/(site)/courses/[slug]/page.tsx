import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BookingButton } from "@/components/booking-button";
import { OrnamentDivider } from "@/components/ornament";
import { miniatureFor } from "@/lib/miniatures";
import { prisma } from "@/lib/prisma";
import { AGE_GROUP_LABELS, WEEKDAY_LABELS } from "@/lib/course-labels";
import { toGermanTime } from "@/lib/schedule-time";
import { SubscribeButton } from "./subscribe-button";

// Die angezeigten Unterrichtszeiten haengen von der deutschen Sommer-/Winterzeit
// ab, daher stuendlich neu erzeugen.
export const revalidate = 3600;

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = await prisma.course.findUnique({
    where: { slug },
    include: {
      teacher: { select: { id: true, name: true } },
      scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
    },
  });

  if (!course || !course.isPublished) {
    notFound();
  }

  const miniature = miniatureFor(course);

  return (
    <article className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
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
        <p className="mt-1 text-brand-600">
          Lehrer:{" "}
          <Link
            href={`/lehrer#lehrer-${course.teacher.id}`}
            className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-600"
          >
            {course.teacher.name}
          </Link>
        </p>
        <OrnamentDivider className="mt-3" />
        <p className="mt-3 text-brand-900">{course.description}</p>
      </div>

      {miniature && (
        <figure className="w-44 shrink-0 self-center sm:w-52 sm:self-start">
          <div className="relative aspect-[3/4] overflow-hidden rounded-t-full border-4 border-gold-400 bg-brand-100 shadow-md">
            <Image
              src={miniature.src}
              alt={miniature.title}
              fill
              sizes="208px"
              className="object-cover"
              style={{ objectPosition: miniature.focus }}
            />
          </div>
          <figcaption className="mt-1 text-center text-xs text-brand-600">
            Persische Miniatur
          </figcaption>
        </figure>
      )}
      </div>

      {course.scheduleSlots.length > 0 && (
        <div>
          <h2 className="font-semibold text-brand-700">Wöchentlicher Unterricht</h2>
          <ul className="mt-2 space-y-1 text-sm text-brand-900">
            {course.scheduleSlots.map((rawSlot) => {
              const slot = toGermanTime(rawSlot);
              return (
                <li key={slot.id}>
                  {WEEKDAY_LABELS[slot.weekday] ?? slot.weekday}: {slot.startTime}–{slot.endTime}
                  {slot.note ? ` (${slot.note})` : ""}
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-xs text-brand-600">Alle Zeiten in deutscher Zeit.</p>
        </div>
      )}

      <div className="rounded-lg border border-brand-200 bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            {course.priceCents > 0 ? (
              <>
                <p className="text-2xl font-bold text-brand-700">
                  {formatPrice(course.priceCents, course.currency)}
                  <span className="text-base font-normal text-brand-600"> / Monat</span>
                </p>
                <p className="text-sm text-brand-600">Monatlich kündbar, keine Mindestlaufzeit</p>
              </>
            ) : (
              <p className="text-xl font-bold text-brand-700">Preis auf Anfrage</p>
            )}
          </div>
          {course.stripePriceId && <SubscribeButton courseId={course.id} slug={course.slug} />}
        </div>
        {!course.stripePriceId && (
          <p className="mt-3 text-sm text-brand-600">
            Die Online-Anmeldung für diesen Kurs ist noch nicht freigeschaltet. Buche gern ein
            kostenloses Beratungsgespräch, dann klären wir alles Weitere.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-5 text-center">
        <p className="mb-3 text-brand-700">Unsicher, ob dieser Kurs passt? Lass es uns unverbindlich besprechen.</p>
        <BookingButton />
      </div>
    </article>
  );
}
