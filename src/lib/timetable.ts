import { WEEKDAY_ORDER } from "@/lib/course-labels";

export type TimetableBlock = {
  slug: string;
  title: string;
  category: string;
  weekday: string;
  startMinutes: number;
  endMinutes: number;
  note: string | null;
};

const ROW_MINUTES = 15;

function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// Baut die Daten für die grafische Wochenansicht: Zeitraster (in 15-Minuten-
// Schritten) begrenzt auf die tatsächlich belegte Zeitspanne, plus die
// Positionierung jedes Kurstermins darin (für CSS-Grid row-start/row-span).
export function buildTimetable(
  courses: { slug: string; title: string; category: string; scheduleSlots: { weekday: string; startTime: string; endTime: string; note: string | null }[] }[],
) {
  const blocks: TimetableBlock[] = [];
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const course of courses) {
    for (const slot of course.scheduleSlots) {
      const startMinutes = timeToMinutes(slot.startTime);
      const endMinutes = timeToMinutes(slot.endTime);
      blocks.push({
        slug: course.slug,
        title: course.title,
        category: course.category,
        weekday: slot.weekday,
        startMinutes,
        endMinutes,
        note: slot.note,
      });
      minStart = Math.min(minStart, startMinutes);
      maxEnd = Math.max(maxEnd, endMinutes);
    }
  }

  if (blocks.length === 0) {
    return { days: [] as string[], hourMarks: [] as number[], gridStart: 0, totalRows: 0, blocks };
  }

  const gridStart = Math.floor(minStart / 60) * 60;
  const gridEnd = Math.ceil(maxEnd / 60) * 60;
  const totalRows = (gridEnd - gridStart) / ROW_MINUTES;

  const hourMarks: number[] = [];
  for (let m = gridStart; m <= gridEnd; m += 60) hourMarks.push(m);

  const days = WEEKDAY_ORDER.filter((day) => blocks.some((b) => b.weekday === day));

  return { days, hourMarks, gridStart, totalRows, blocks };
}

export function minutesToRow(minutes: number, gridStart: number) {
  return Math.floor((minutes - gridStart) / ROW_MINUTES) + 1;
}

export function formatHour(minutes: number) {
  const h = Math.floor(minutes / 60);
  return `${h.toString().padStart(2, "0")}:00`;
}
