import Link from "next/link";

import { BookingButton } from "@/components/booking-button";
import { WEEKDAY_LABELS } from "@/lib/course-labels";
import { prisma } from "@/lib/prisma";
import { buildTimetable, formatHour, minutesToRow, ROW_HEIGHT_PX } from "@/lib/timetable";

// Die Anzeige haengt von der deutschen Sommer-/Winterzeit ab, daher stuendlich neu
// erzeugen, damit sie nach der Zeitumstellung nicht veraltet bleibt.
export const revalidate = 3600;

const NAVY = "#14325c";
const CREAM = "#fdf6e3";
const GRID_LINE = "#e6dcc0";

export default async function TimetablePage() {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    include: { scheduleSlots: true },
  });

  const { days, hourMarks, gridStart, totalRows, blocks, legend, footnotes } =
    buildTimetable(courses);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-brand-700">Stundenplan</h1>
          <p className="mt-2 text-brand-600">
            Alle wöchentlichen Unterrichtszeiten auf einen Blick. Klick auf einen Termin für
            Details zum Kurs.
          </p>
        </div>
        {blocks.length > 0 && (
          <a
            href="/stundenplan/pdf"
            download
            className="rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            Als PDF herunterladen
          </a>
        )}
      </section>

      {blocks.length === 0 ? (
        <p className="text-brand-600">Aktuell sind keine Unterrichtszeiten hinterlegt.</p>
      ) : (
        <div
          className="overflow-x-auto rounded-xl border-2 p-0"
          style={{ borderColor: NAVY, backgroundColor: CREAM }}
        >
          <div
            className="grid min-w-[760px]"
            style={{
              gridTemplateColumns: `76px repeat(${days.length}, minmax(112px, 1fr))`,
              gridTemplateRows: `auto repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`,
            }}
          >
            <div
              className="px-2 py-2 text-center text-xs leading-tight text-white"
              style={{ backgroundColor: NAVY }}
            >
              <p className="font-semibold">Uhrzeit</p>
              <p className="opacity-80">(deutsche Zeit)</p>
            </div>
            {days.map((day) => (
              <div
                key={day}
                className="flex items-center justify-center px-2 py-2 text-center font-semibold text-white"
                style={{ backgroundColor: NAVY }}
              >
                {WEEKDAY_LABELS[day]}
              </div>
            ))}

            {hourMarks.slice(0, -1).map((mark) => (
              <div
                key={`label-${mark}`}
                className="pr-2 pt-0.5 text-right text-xs text-brand-600"
                style={{
                  gridColumn: 1,
                  gridRow: `${minutesToRow(mark, gridStart) + 1} / span 12`,
                }}
              >
                {formatHour(mark)}
              </div>
            ))}

            {hourMarks.map((mark) => (
              <div
                key={`line-${mark}`}
                className="border-t"
                style={{
                  borderColor: GRID_LINE,
                  gridColumn: `1 / span ${days.length + 1}`,
                  gridRow: minutesToRow(mark, gridStart) + 1,
                }}
              />
            ))}

            {blocks.map((block, i) => {
              const dayIndex = days.indexOf(block.weekday);
              if (dayIndex === -1) return null;
              const rowStart = minutesToRow(block.startMinutes, gridStart) + 1;
              const rowEnd = minutesToRow(block.endMinutes, gridStart) + 1;

              return (
                <Link
                  key={`${block.slug}-${i}`}
                  href={`/courses/${block.slug}`}
                  title={block.title}
                  className="m-0.5 overflow-hidden rounded-lg border p-1.5 text-center text-xs leading-tight transition hover:brightness-95"
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: `${rowStart} / ${rowEnd}`,
                    backgroundColor: block.palette.bg,
                    borderColor: block.palette.border,
                    color: block.palette.text,
                  }}
                >
                  <p className="font-semibold">
                    {block.shortTitle}
                    {block.marked ? "*" : ""}
                  </p>
                  <p className="mt-0.5">
                    {block.startTime} – {block.endTime}
                  </p>
                  {block.note && <p className="opacity-80">{block.note}</p>}
                </Link>
              );
            })}
          </div>

          <div className="space-y-3 border-t-2 p-4" style={{ borderColor: NAVY }}>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-brand-700">
              {legend.map((entry) => (
                <span key={entry.key} className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded border"
                    style={{ backgroundColor: entry.palette.bg, borderColor: entry.palette.border }}
                  />
                  {entry.label}
                </span>
              ))}
            </div>
            {footnotes.map((note) => (
              <p key={note} className="text-xs text-brand-600">
                {note}
              </p>
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
