import Image from "next/image";
import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { BookingButton } from "@/components/booking-button";
import { OrnamentDivider } from "@/components/ornament";
import { accessQuery } from "@/lib/course-access";
import { capacityOf } from "@/lib/course-capacity";
import { AGE_GROUP_LABELS, WEEKDAY_LABELS } from "@/lib/course-labels";
import { priceSummary } from "@/lib/course-pricing";
import { miniatureFor } from "@/lib/miniatures";
import { toGermanTime } from "@/lib/schedule-time";
import { SubscribeButton } from "./subscribe-button";
import { WaitlistForm } from "./waitlist-form";

export const courseDetailInclude = {
  teacher: { select: { id: true, name: true } },
  scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
  _count: { select: { enrollments: true } },
} satisfies Prisma.CourseInclude;

export type CourseDetailData = Prisma.CourseGetPayload<{ include: typeof courseDetailInclude }>;

// Inhalt der Kursseite, genutzt von /courses/<slug> (oeffentliche Kurse) und /zugang/<code>
// (versteckte Kurse, z. B. Testphase).
export function CourseDetail({ course }: { course: CourseDetailData }) {
  const miniature = miniatureFor(course);
  const price = priceSummary(course);
  const isFull = capacityOf(course.maxParticipants, course._count.enrollments).isFull;

  return (
    <article className="space-y-6">
      <div className="flex gap-5 sm:gap-7">
        {miniature && (
          <div className="relative h-28 w-28 shrink-0 overflow-hidden border border-brand-200 bg-brand-100 shadow-sm sm:h-44 sm:w-44">
            <Image
              src={miniature.src}
              alt={miniature.title}
              fill
              sizes="176px"
              className="object-cover"
              style={{ objectPosition: miniature.focus }}
            />
          </div>
        )}

        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-azure-700">
            {course.category}
            {course.level ? ` · ${course.level}` : ""}
          </p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight text-azure-800 sm:text-4xl">
            {course.title}
          </h1>
          <p className="mt-2 text-brand-900/75">
            Lehrer:{" "}
            <Link
              href={`/lehrer#lehrer-${course.teacher.id}`}
              className="font-medium text-azure-800 underline underline-offset-2 hover:text-azure-700"
            >
              {course.teacher.name}
            </Link>
          </p>
          {course.ageGroups.length > 0 && (
            <p className="mt-1 text-sm text-brand-600">
              {course.ageGroups.map((ag) => AGE_GROUP_LABELS[ag] ?? ag).join(" · ")}
            </p>
          )}
          <OrnamentDivider className="mt-4" />
          <p className="mt-4 max-w-2xl text-brand-900">{course.description}</p>
        </div>
      </div>

      {course.scheduleSlots.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold text-azure-800">Wöchentlicher Unterricht</h2>
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

      {isFull && (
        <div className="border border-gold-400/40 bg-white p-6">
          <div className="flex flex-wrap items-center gap-4">
            <span className="bg-azure-800 px-3.5 py-1 font-display text-lg font-bold uppercase tracking-wider text-white">
              Ausgebucht
            </span>
            <p className="min-w-0 flex-1 text-brand-900">
              Dieser Kurs ist aktuell voll. Trage dich gern auf die Warteliste ein: Wir melden uns,
              sobald ein Platz frei wird, oder zum nächsten Semester.
            </p>
          </div>
          <h2 className="mt-6 text-xl font-semibold text-azure-800">Auf die Warteliste</h2>
          <p className="mb-4 mt-1 text-sm text-brand-900/75">
            Kostenlos und unverbindlich, es ist keine Zahlung nötig.
          </p>
          <WaitlistForm courseId={course.id} />
        </div>
      )}

      {!isFull && (
        <div className="border border-gold-400/40 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              {price ? (
                <>
                  <p className="text-2xl font-bold text-brand-700">{price.headline}</p>
                  <p className="text-sm text-brand-600">{price.detail}</p>
                </>
              ) : (
                <p className="text-xl font-bold text-brand-700">Preis auf Anfrage</p>
              )}
            </div>
            {course.stripePriceId && <SubscribeButton slug={course.slug} query={accessQuery(course)} />}
          </div>
          {!course.stripePriceId && (
            <p className="mt-3 text-sm text-brand-600">
              Die Online-Anmeldung für diesen Kurs ist noch nicht freigeschaltet. Buche gern ein
              kostenloses Beratungsgespräch, dann klären wir alles Weitere.
            </p>
          )}
        </div>
      )}

      <div className="border border-brand-200 bg-brand-50 p-5 text-center">
        <p className="mb-3 text-brand-700">Unsicher, ob dieser Kurs passt? Lass es uns unverbindlich besprechen.</p>
        <BookingButton />
      </div>
    </article>
  );
}
