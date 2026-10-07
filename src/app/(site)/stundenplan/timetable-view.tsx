import Link from "next/link";

import { WEEKDAY_LABELS } from "@/lib/course-labels";
import {
  formatClock,
  minutesToRow,
  ROW_HEIGHT_PX,
  ROW_MINUTES,
  type Timetable,
} from "@/lib/timetable";
import { TimetableIcon } from "./timetable-icon";

const HOUR_LINE = "#ddd3bb";
const HALF_HOUR_LINE = "#eee8d8";

export function TimetableView({ timetable }: { timetable: Timetable }) {
  const { days, timeMarks, gridStart, totalRows, blocks, legend, footnotes } = timetable;
  const rowsPerHalfHour = 30 / ROW_MINUTES;

  return (
    <div className="overflow-hidden rounded-md border border-brand-200 bg-white shadow-sm">
      {/* Raster ab Desktop-Breite */}
      <div className="hidden lg:block">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`,
            gridTemplateRows: `auto repeat(${totalRows}, ${ROW_HEIGHT_PX}px)`,
          }}
        >
          <div className="bg-azure-800 px-1 py-3 text-center text-[11px] leading-tight text-white/80">
            Uhrzeit
          </div>
          {days.map((day) => (
            <div
              key={day}
              className="bg-azure-800 px-2 py-3 text-center font-display text-lg font-semibold tracking-wide text-white"
            >
              {WEEKDAY_LABELS[day]}
            </div>
          ))}

          {timeMarks.slice(0, -1).map((mark) => (
            <div
              key={`label-${mark}`}
              className="pr-2 pt-0.5 text-right text-xs text-brand-900/60"
              style={{
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
                className="m-0.5 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-md border p-2 text-center leading-tight transition hover:brightness-95"
                style={{
                  gridColumn: dayIndex + 2,
                  gridRow: `${rowStart} / ${rowEnd}`,
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
                <span className="font-display text-[15px] font-semibold [hyphens:auto] [overflow-wrap:anywhere]">
                  {block.shortTitle}
                  {block.marked ? "*" : ""}
                </span>
                <span className="text-xs">
                  {block.startTime} – {block.endTime}
                </span>
                {block.note && <span className="text-xs opacity-80">{block.note}</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Tageskarten untereinander auf Handy und schmalen Fenstern */}
      <div className="space-y-4 p-3 lg:hidden">
        {days.map((day) => (
          <section key={day} className="overflow-hidden rounded-md border border-brand-200">
            <h2 className="bg-azure-800 px-4 py-2 font-display text-lg font-semibold tracking-wide text-white">
              {WEEKDAY_LABELS[day]}
            </h2>
            <ul className="space-y-2 p-2">
              {blocks
                .filter((block) => block.weekday === day)
                .sort((a, b) => a.startMinutes - b.startMinutes)
                .map((block, i) => (
                  <li key={`${block.slug}-${i}`}>
                    <Link
                      href={`/courses/${block.slug}`}
                      className="flex items-center gap-3 rounded-md border p-3"
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
                        className="h-9 w-9 shrink-0"
                      />
                      <span className="min-w-0 [hyphens:auto] [overflow-wrap:anywhere]">
                        <span className="block font-display text-lg font-semibold leading-tight">
                          {block.shortTitle}
                          {block.marked ? "*" : ""}
                        </span>
                        <span className="block text-sm">
                          {block.startTime} – {block.endTime} Uhr
                          {block.note ? ` · ${block.note}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="space-y-3 border-t border-brand-200 p-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-brand-900/80">
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
          <p key={note} className="text-xs text-brand-900/70">
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}
