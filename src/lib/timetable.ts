import { WEEKDAY_ORDER } from "@/lib/course-labels";
import {
  hoursAheadOfGermany,
  timeToMinutes,
  toGermanTime,
  toGermanTimeRange,
} from "@/lib/schedule-time";

export type BlockPalette = { bg: string; border: string; text: string };

export type TimetableBlock = {
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  weekday: string;
  startMinutes: number;
  endMinutes: number;
  startTime: string;
  endTime: string;
  note: string | null;
  palette: BlockPalette;
  marked: boolean;
};

export type LegendEntry = { key: string; label: string; palette: BlockPalette };

type TimetableCourse = {
  slug: string;
  title: string;
  category: string;
  scheduleSlots: { weekday: string; startTime: string; endTime: string; note: string | null }[];
};

// 5-Minuten-Raster, damit auch Termine wie 15:50 oder 17:40 exakt im Raster liegen.
export const ROW_MINUTES = 5;
export const ROW_HEIGHT_PX = 7;

const PALETTES: BlockPalette[] = [
  { bg: "#cfe6fa", border: "#8dc0ec", text: "#12385e" }, // blau
  { bg: "#e0d4f5", border: "#b3a0e0", text: "#3a2468" }, // lila
  { bg: "#f8cfcb", border: "#e49b95", text: "#6b1f1a" }, // rosa
  { bg: "#fbe2ad", border: "#e6bb5e", text: "#5f4208" }, // amber
  { bg: "#f6d3a0", border: "#d9a24a", text: "#58370a" }, // gold
  { bg: "#cfeadb", border: "#92cfb0", text: "#14513a" }, // gruen
];

// Feste Zuordnung wie in der Vorlagen-Grafik: alle Qur'an-Level teilen sich eine
// Farbe, die uebrigen Kurse haben je eine eigene. Neue Kurse bekommen der Reihe
// nach die uebrigen Farben.
const FIXED_PALETTE_INDEX: Record<string, number> = {
  "Qur'an-Rezitation": 0,
  "imam-al-ghazali-kurs": 1,
  "shamail-und-seerah": 2,
  "einstieg-fiqh-aqidah": 3,
  "islamische-seelenlehre-charakterbildung": 4,
};

// Kurse mit alternativer Uhrzeit (Ortszeit), im Stundenplan mit * markiert.
const ALTERNATIVE_TIMES = [
  { slug: "imam-al-ghazali-kurs", startTime: "18:00", endTime: "19:00" },
  { slug: "einstieg-fiqh-aqidah", startTime: "18:00", endTime: "19:00" },
];

function colorKey(course: TimetableCourse) {
  return course.category === "Qur'an-Rezitation" ? course.category : course.slug;
}

function pluralHours(hours: number) {
  return hours === 1 ? "1 Stunde" : `${hours} Stunden`;
}

// Baut die Daten fuer die grafische Wochenansicht und das PDF: Termine in deutscher
// Zeit, Zeitraster begrenzt auf die tatsaechlich belegte Zeitspanne, Farben,
// Legende und Fussnoten.
export function buildTimetable(courses: TimetableCourse[], now: Date = new Date()) {
  const blocks: TimetableBlock[] = [];
  const paletteIndexByKey = new Map<string, number>();
  let nextFreeIndex = Object.keys(FIXED_PALETTE_INDEX).length;
  const alternativeSlugs = new Set(ALTERNATIVE_TIMES.map((a) => a.slug));
  let minStart = Infinity;
  let maxEnd = -Infinity;

  for (const course of courses) {
    const key = colorKey(course);
    if (!paletteIndexByKey.has(key)) {
      const fixed = FIXED_PALETTE_INDEX[key];
      paletteIndexByKey.set(key, fixed ?? nextFreeIndex++ % PALETTES.length);
    }
    const palette = PALETTES[paletteIndexByKey.get(key)!];

    for (const rawSlot of course.scheduleSlots) {
      const slot = toGermanTime(rawSlot, now);
      const startMinutes = timeToMinutes(slot.startTime);
      const endMinutes = timeToMinutes(slot.endTime);
      blocks.push({
        slug: course.slug,
        title: course.title,
        shortTitle: course.title.split(" – ")[0],
        category: course.category,
        weekday: slot.weekday,
        startMinutes,
        endMinutes,
        startTime: slot.startTime,
        endTime: slot.endTime,
        note: slot.note,
        palette,
        marked: alternativeSlugs.has(course.slug),
      });
      minStart = Math.min(minStart, startMinutes);
      maxEnd = Math.max(maxEnd, endMinutes);
    }
  }

  const legend: LegendEntry[] = [];
  const seenKeys = new Set<string>();
  for (const course of courses) {
    const key = colorKey(course);
    if (seenKeys.has(key) || !blocks.some((b) => b.slug === course.slug)) continue;
    seenKeys.add(key);
    legend.push({
      key,
      label: key === course.category ? course.category : course.title,
      palette: PALETTES[paletteIndexByKey.get(key)!],
    });
  }
  legend.sort((a, b) => PALETTES.indexOf(a.palette) - PALETTES.indexOf(b.palette));

  const footnotes = [
    `Alle Zeiten in deutscher Zeit (MEZ/MESZ). Der Unterricht findet zu festen Zeiten in Nordzypern statt (Ortszeit UTC+3, ohne Zeitumstellung); dort ist es aktuell ${pluralHours(hoursAheadOfGermany(now))} später als in Deutschland.`,
  ];
  const alternatives = ALTERNATIVE_TIMES.flatMap((alt) => {
    const course = courses.find((c) => c.slug === alt.slug);
    if (!course || !blocks.some((b) => b.slug === alt.slug)) return [];
    const range = toGermanTimeRange(alt.startTime, alt.endTime, now);
    return [`${course.title}: ${range.startTime}–${range.endTime} Uhr`];
  });
  if (alternatives.length > 0) {
    footnotes.push(`* Alternative Zeiten (nur für markierte Kurse): ${alternatives.join(" | ")}`);
  }

  if (blocks.length === 0) {
    return {
      days: [] as string[],
      hourMarks: [] as number[],
      gridStart: 0,
      gridEnd: 0,
      totalRows: 0,
      blocks,
      legend,
      footnotes,
    };
  }

  const gridStart = Math.floor(minStart / 60) * 60;
  const gridEnd = Math.ceil(maxEnd / 60) * 60;
  const totalRows = (gridEnd - gridStart) / ROW_MINUTES;

  const hourMarks: number[] = [];
  for (let m = gridStart; m <= gridEnd; m += 60) hourMarks.push(m);

  const days = WEEKDAY_ORDER.filter((day) => blocks.some((b) => b.weekday === day));

  return { days, hourMarks, gridStart, gridEnd, totalRows, blocks, legend, footnotes };
}

export type Timetable = ReturnType<typeof buildTimetable>;

export function minutesToRow(minutes: number, gridStart: number) {
  return Math.floor((minutes - gridStart) / ROW_MINUTES) + 1;
}

export function formatHour(minutes: number) {
  const h = Math.floor(minutes / 60);
  return `${h.toString().padStart(2, "0")}:00`;
}
