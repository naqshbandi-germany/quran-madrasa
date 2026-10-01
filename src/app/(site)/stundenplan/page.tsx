import Link from "next/link";

import { BookingButton } from "@/components/booking-button";
import { WEEKDAY_LABELS } from "@/lib/course-labels";
import { prisma } from "@/lib/prisma";
import { buildTimetable, formatHour, minutesToRow } from "@/lib/timetable";

// Feste Farbpalette pro Thema, damit der Stundenplan auf einen Blick lesbar ist.
const CATEGORY_COLORS = [
  "bg-brand-600",
  "bg-amber-600",
  "bg-sky-600",
  "bg-rose-600",
  "bg-violet-600",
  "bg-teal-600",
];

export default async function TimetablePage() {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    include: { scheduleSlots: true },
  });

  const { days, hourMarks, gridStart, totalRows, blocks } = buildTimetable(courses);

  const categories = Array.from(new Set(courses.map((c) => c.category)));
  const colorByCategory = new Map(
    categories.map((cat, i) => [cat, CATEGORY_COLORS[i % CATEGORY_COLORS.length]]),
  );

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-brand-700">Stundenplan</h1>
        <p className="mt-2 text-brand-600">
          Alle wöchentlichen Unterrichtszeiten auf einen Blick. Klick auf einen Termin für Details
          zum Kurs.
        </p>
      </section>

      {blocks.length === 0 ? (
        <p className="text-brand-600">Aktuell sind keine Unterrichtszeiten hinterlegt.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brand-200 bg-white p-4">
          <div
            className="grid min-w-[720px] gap-px bg-brand-100"
            style={{
              gridTemplateColumns: `64px repeat(${days.length}, minmax(120px, 1fr))`,
              gridTemplateRows: `auto repeat(${totalRows}, 12px)`,
            }}
          >
            <div className="bg-white" />
            {days.map((day) => (
              <div
                key={day}
                className="bg-white px-2 py-2 text-center text-sm font-semibold text-brand-700"
              >
                {WEEKDAY_LABELS[day]}
              </div>
            ))}

            {hourMarks.map((mark) => (
              <div
                key={`label-${mark}`}
                className="bg-white pr-2 text-right text-xs text-brand-400"
                style={{ gridColumn: 1, gridRow: minutesToRow(mark, gridStart) + 1 }}
              >
                {formatHour(mark)}
              </div>
            ))}

            {hourMarks.map((mark) => (
              <div
                key={`line-${mark}`}
                className="border-t border-brand-100"
                style={{
                  gridColumn: `2 / span ${days.length}`,
                  gridRow: minutesToRow(mark, gridStart) + 1,
                }}
              />
            ))}

            {blocks.map((block, i) => {
              const dayIndex = days.indexOf(block.weekday);
              if (dayIndex === -1) return null;
              const rowStart = minutesToRow(block.startMinutes, gridStart) + 1;
              const rowEnd = minutesToRow(block.endMinutes, gridStart) + 1;
              const color = colorByCategory.get(block.category) ?? "bg-brand-600";

              return (
                <Link
                  key={`${block.slug}-${i}`}
                  href={`/courses/${block.slug}`}
                  className={`m-0.5 overflow-hidden rounded-md p-1.5 text-xs text-white transition hover:opacity-90 ${color}`}
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: `${rowStart} / ${rowEnd}`,
                  }}
                >
                  <p className="font-medium leading-tight">{block.title}</p>
                  {block.note && <p className="leading-tight opacity-80">{block.note}</p>}
                </Link>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs text-brand-600">
            {categories.map((cat) => (
              <span key={cat} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${colorByCategory.get(cat)}`} />
                {cat}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-5 text-center">
        <p className="mb-3 text-brand-700">
          Nicht sicher, welcher Kurs passt? Lass uns das in einem kurzen, kostenlosen Gespräch
          klären.
        </p>
        <BookingButton />
      </div>
    </div>
  );
}
