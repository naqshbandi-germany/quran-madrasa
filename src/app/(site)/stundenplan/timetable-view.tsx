import Link from "next/link";

import { WEEKDAY_LABELS } from "@/lib/course-labels";
import {
  formatClock,
  minutesToRow,
  ROW_HEIGHT_PX,
  ROW_MINUTES,
  type Timetable,
} from "@/lib/timetable";
import { Skyline, TimetableIcon } from "./timetable-icon";

const NAVY = "#14325c";
const GOLD = "#c9a85c";
const CREAM = "#fdf6e3";
const HOUR_LINE = "#dccfa9";
const HALF_HOUR_LINE = "#efe6cc";

export function TimetableView({ timetable }: { timetable: Timetable }) {
  const { days, timeMarks, gridStart, totalRows, blocks, legend, footnotes } = timetable;
  const rowsPerHalfHour = 30 / ROW_MINUTES;

  return (
    <div className="rounded-2xl border-[3px] p-1" style={{ borderColor: NAVY }}>
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: GOLD, backgroundColor: CREAM }}
      >
        <div className="flex items-end justify-between gap-2 px-3 pt-4 sm:px-5">
          <Skyline side="left" className="hidden h-12 w-auto shrink-0 sm:block lg:h-16" />
          <div className="flex-1 pb-3 text-center" style={{ color: NAVY }}>
            <h1 className="font-serif text-2xl font-bold uppercase tracking-wide sm:text-3xl lg:text-4xl">
              Wöchentlicher Stundenplan
            </h1>
            <p className="mt-1 text-[11px] uppercase tracking-[0.3em] sm:text-sm sm:tracking-[0.4em]">
              Unterricht &amp; Verfügbarkeit
            </p>
          </div>
          <Skyline side="right" className="hidden h-12 w-auto shrink-0 sm:block lg:h-16" />
        </div>

        {/* Raster ab Tablet-Breite */}
        <div className="hidden overflow-x-auto lg:block">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
              gridTemplateRows: `auto repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`,
              borderTop: `2px solid ${NAVY}`,
            }}
          >
            <div
              className="px-1 py-2 text-center text-[11px] leading-tight text-white"
              style={{ backgroundColor: NAVY }}
            >
              <p className="font-semibold">Uhrzeit</p>
              <p className="opacity-80">(deutsche Zeit)</p>
            </div>
            {days.map((day) => (
              <div
                key={day}
                className="flex items-center justify-center px-2 py-2 text-center font-serif text-lg font-semibold text-white"
                style={{ backgroundColor: NAVY }}
              >
                {WEEKDAY_LABELS[day]}
              </div>
            ))}

            {timeMarks.slice(0, -1).map((mark) => (
              <div
                key={`label-${mark}`}
                className="pr-2 pt-0.5 text-right text-xs"
                style={{
                  color: NAVY,
                  gridColumn: 1,
                  gridRow: `${minutesToRow(mark, gridStart) + 1} / span ${rowsPerHalfHour}`,
                }}
              >
                {formatClock(mark)}
              </div>
            ))}

            {timeMarks.map((mark) => (
              <div
                key={`line-${mark}`}
                className="border-t"
                style={{
                  borderColor: mark % 60 === 0 ? HOUR_LINE : HALF_HOUR_LINE,
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
                  className="relative m-0.5 flex items-start gap-1.5 overflow-hidden rounded-lg border p-1.5 leading-tight shadow-sm transition hover:brightness-95"
                  style={{
                    gridColumn: dayIndex + 2,
                    gridRow: `${rowStart} / ${rowEnd}`,
                    backgroundColor: block.palette.bg,
                    borderColor: block.palette.border,
                    color: block.palette.text,
                  }}
                >
                  {block.miniature && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-y-0 right-0 w-1/2 bg-cover opacity-60"
                      style={{
                        backgroundImage: `url(${block.miniature.src})`,
                        backgroundPosition: block.miniature.focus,
                        maskImage: "linear-gradient(to right, transparent, black 70%)",
                        WebkitMaskImage: "linear-gradient(to right, transparent, black 70%)",
                      }}
                    />
                  )}
                  <TimetableIcon
                    name={block.icon}
                    color={block.palette.text}
                    background={block.palette.bg}
                    className="relative mt-0.5 h-6 w-6 shrink-0"
                  />
                  <span className="relative min-w-0 [hyphens:auto] [overflow-wrap:anywhere]">
                    <span className="block font-serif text-[13px] font-semibold">
                      {block.shortTitle}
                      {block.marked ? "*" : ""}
                    </span>
                    <span className="mt-0.5 block text-xs">
                      {block.startTime} – {block.endTime}
                    </span>
                    {block.note && <span className="block text-xs opacity-80">{block.note}</span>}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Tageskarten untereinander auf Handy und schmalen Fenstern */}
        <div className="space-y-4 p-3 lg:hidden" style={{ borderTop: `2px solid ${NAVY}` }}>
          {days.map((day) => (
            <section
              key={day}
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: NAVY }}
            >
              <h2
                className="px-4 py-2 font-serif text-lg font-semibold text-white"
                style={{ backgroundColor: NAVY }}
              >
                {WEEKDAY_LABELS[day]}
              </h2>
              <ul className="space-y-2 bg-white/60 p-2">
                {blocks
                  .filter((block) => block.weekday === day)
                  .sort((a, b) => a.startMinutes - b.startMinutes)
                  .map((block, i) => (
                    <li key={`${block.slug}-${i}`}>
                      <Link
                        href={`/courses/${block.slug}`}
                        className="flex items-center gap-3 rounded-lg border px-3 py-2.5 shadow-sm"
                        style={{
                          backgroundColor: block.palette.bg,
                          borderColor: block.palette.border,
                          color: block.palette.text,
                        }}
                      >
                        <TimetableIcon
                          name={block.icon}
                          color={block.palette.text}
                          background={block.palette.bg}
                          className="h-8 w-8 shrink-0"
                        />
                        <span className="min-w-0 [hyphens:auto] [overflow-wrap:anywhere]">
                          <span className="block font-serif text-base font-semibold leading-tight">
                            {block.shortTitle}
                            {block.marked ? "*" : ""}
                          </span>
                          <span className="block text-sm">
                            {block.startTime} – {block.endTime} Uhr
                            {block.note ? ` · ${block.note}` : ""}
                          </span>
                        </span>
                        {block.miniature && (
                          <span
                            aria-hidden="true"
                            className="ml-auto h-14 w-14 shrink-0 rounded-full border-2 bg-cover shadow-sm"
                            style={{
                              backgroundImage: `url(${block.miniature.src})`,
                              backgroundPosition: block.miniature.focus,
                              borderColor: GOLD,
                            }}
                          />
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="space-y-3 border-t-2 p-4" style={{ borderColor: NAVY }}>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ color: NAVY }}>
            {legend.map((entry) => (
              <span key={entry.key} className="flex items-center gap-1.5">
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-md border"
                  style={{ backgroundColor: entry.palette.bg, borderColor: entry.palette.border }}
                >
                  <TimetableIcon
                    name={entry.icon}
                    color={entry.palette.text}
                    background={entry.palette.bg}
                    className="h-4 w-4"
                  />
                </span>
                {entry.label}
              </span>
            ))}
          </div>
          {footnotes.map((note) => (
            <p key={note} className="text-xs" style={{ color: NAVY }}>
              {note}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
