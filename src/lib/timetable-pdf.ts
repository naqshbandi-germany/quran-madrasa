import {
  LineCapStyle,
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import { WEEKDAY_LABELS } from "@/lib/course-labels";
import { formatClock, type Timetable } from "@/lib/timetable";
import { ICONS, type IconName } from "@/lib/timetable-art";

const NAVY = "#14325c";
const TEXT = "#1d2a24";
const GRAY = "#5b6470";
const HOUR_LINE = "#ddd3bb";
const HALF_HOUR_LINE = "#eee8d8";
const GRID_BORDER = "#e3dac3";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 30;
const TIME_COLUMN_WIDTH = 48;
const HEADER_HEIGHT = 26;

function color(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Die Standard-PDF-Schriften kennen nur WinAnsi-Zeichen; alles andere wuerde das
// Zeichnen abbrechen lassen.
function pdfSafe(text: string) {
  return text.replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…€]/g, "?");
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of pdfSafe(text).split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundedRectPath(w: number, h: number, r: number) {
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
}

function drawRoundedRect(
  page: PDFPage,
  x: number,
  topY: number,
  w: number,
  h: number,
  radius: number,
  fill: string | null,
  border: string,
  borderWidth = 0.8,
) {
  page.drawSvgPath(roundedRectPath(w, h, radius), {
    x,
    y: topY,
    color: fill ? color(fill) : undefined,
    borderColor: color(border),
    borderWidth,
  });
}

function drawIcon(
  page: PDFPage,
  name: IconName,
  x: number,
  topY: number,
  size: number,
  main: string,
  background: string,
) {
  const scale = size / 24;
  for (const part of ICONS[name]) {
    const tone = color(part.tone === "main" ? main : background);
    if (part.mode === "fill") {
      page.drawSvgPath(part.d, { x, y: topY, scale, color: tone });
    } else {
      page.drawSvgPath(part.d, {
        x,
        y: topY,
        scale,
        borderColor: tone,
        borderWidth: part.width ?? 1,
        borderLineCap: LineCapStyle.Round,
      });
    }
  }
}

function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  centerX: number,
  baselineY: number,
  fill: string,
) {
  const safe = pdfSafe(text);
  page.drawText(safe, {
    x: centerX - font.widthOfTextAtSize(safe, size) / 2,
    y: baselineY,
    size,
    font,
    color: color(fill),
  });
}

export async function renderTimetablePdf(timetable: Timetable): Promise<Uint8Array> {
  const { days, timeMarks, gridStart, gridEnd, blocks, legend, footnotes } = timetable;

  const doc = await PDFDocument.create();
  doc.setTitle("Wöchentlicher Stundenplan");
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const contentWidth = PAGE_WIDTH - 2 * MARGIN;

  drawCentered(page, "Wöchentlicher Stundenplan", serifBold, 24, PAGE_WIDTH / 2, PAGE_HEIGHT - 50, NAVY);
  drawCentered(
    page,
    "Unterricht  ·  alle Zeiten in deutscher Zeit",
    regular,
    9,
    PAGE_WIDTH / 2,
    PAGE_HEIGHT - 66,
    GRAY,
  );

  const stand = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
  }).format(new Date());
  const footnoteLines = [
    ...footnotes.flatMap((note) => wrapText(note, regular, 7, contentWidth)),
    `Stand: ${stand}`,
  ];

  // Legende: Zeilenumbruch, falls die Eintraege nicht in eine Zeile passen.
  const legendFontSize = 8;
  const legendItems = legend.map((entry) => {
    const label = pdfSafe(entry.label);
    return { entry, label, width: 19 + regular.widthOfTextAtSize(label, legendFontSize) + 16 };
  });
  const legendRows: (typeof legendItems)[] = [[]];
  let rowWidth = 0;
  for (const item of legendItems) {
    if (rowWidth + item.width > contentWidth && legendRows[legendRows.length - 1].length > 0) {
      legendRows.push([]);
      rowWidth = 0;
    }
    legendRows[legendRows.length - 1].push(item);
    rowWidth += item.width;
  }

  const footnotesHeight = footnoteLines.length * 9 + 4;
  const legendHeight = legendRows.length * 17 + 6;
  const gridTop = PAGE_HEIGHT - 82;
  const bodyTop = gridTop - HEADER_HEIGHT;
  const bodyBottom = MARGIN + footnotesHeight + legendHeight + 6;
  const bodyHeight = bodyTop - bodyBottom;
  const minutesSpan = gridEnd - gridStart;
  const yOf = (minutes: number) => bodyTop - ((minutes - gridStart) / minutesSpan) * bodyHeight;

  const dayWidth = (contentWidth - TIME_COLUMN_WIDTH) / days.length;
  const gridLeft = MARGIN + TIME_COLUMN_WIDTH;

  // Kopfzeile und Tabellenkoerper
  page.drawRectangle({
    x: MARGIN,
    y: bodyTop,
    width: contentWidth,
    height: HEADER_HEIGHT,
    color: color(NAVY),
  });
  page.drawRectangle({
    x: MARGIN,
    y: bodyBottom,
    width: contentWidth,
    height: bodyHeight,
    color: color("#ffffff"),
    borderColor: color(GRID_BORDER),
    borderWidth: 1,
  });
  drawCentered(page, "Uhrzeit", regular, 7.5, MARGIN + TIME_COLUMN_WIDTH / 2, bodyTop + 9, "#cbd5e1");
  days.forEach((day, i) => {
    drawCentered(
      page,
      WEEKDAY_LABELS[day] ?? day,
      serifBold,
      12.5,
      gridLeft + i * dayWidth + dayWidth / 2,
      bodyTop + 9,
      "#ffffff",
    );
  });

  // Halbstunden-/Stundenlinien, Uhrzeiten und Tagestrenner
  for (const mark of timeMarks) {
    const y = yOf(mark);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + contentWidth, y },
      thickness: 0.5,
      color: color(mark % 60 === 0 ? HOUR_LINE : HALF_HOUR_LINE),
    });
    if (mark < gridEnd) {
      page.drawText(formatClock(mark), {
        x: MARGIN + 9,
        y: y - 9,
        size: 7.5,
        font: regular,
        color: color(GRAY),
      });
    }
  }
  for (let i = 0; i <= days.length; i++) {
    const x = gridLeft + i * dayWidth;
    page.drawLine({
      start: { x, y: bodyTop },
      end: { x, y: bodyBottom },
      thickness: 0.5,
      color: color(HALF_HOUR_LINE),
    });
  }

  // Kurs-Bloecke: Icon, Titel und Uhrzeit zentriert im Block
  const ICON_SIZE = 20;
  const PADDING = 5;
  for (const block of blocks) {
    const dayIndex = days.indexOf(block.weekday);
    if (dayIndex === -1) continue;

    const x = gridLeft + dayIndex * dayWidth + 3;
    const width = dayWidth - 6;
    const top = yOf(block.startMinutes) - 1.5;
    const height = top - (yOf(block.endMinutes) + 1.5);
    drawRoundedRect(page, x, top, width, height, 3, block.palette.bg, block.palette.border);

    const textWidth = width - 2 * PADDING;
    const title = `${block.shortTitle}${block.marked ? "*" : ""}`;
    const timeText = `${block.startTime} – ${block.endTime}`;
    const contentHeight = (lines: number, size: number) =>
      ICON_SIZE + 3 + lines * (size + 2) + (size + 1) + (block.note ? size + 2 : 0);

    let fontSize = 9;
    let titleLines = wrapText(title, serifBold, fontSize, textWidth);
    if (contentHeight(titleLines.length, fontSize) > height - 2 * PADDING) {
      fontSize = 8;
      titleLines = wrapText(title, serifBold, fontSize, textWidth);
    }

    const centerX = x + width / 2;
    let cursor = top - Math.max(PADDING, (height - contentHeight(titleLines.length, fontSize)) / 2);
    drawIcon(
      page,
      block.icon,
      centerX - ICON_SIZE / 2,
      cursor,
      ICON_SIZE,
      block.palette.text,
      block.palette.bg,
    );
    cursor -= ICON_SIZE + 3;

    const lineHeight = fontSize + 2;
    let baseline = cursor - fontSize + 1;
    for (const line of titleLines) {
      drawCentered(page, line, serifBold, fontSize, centerX, baseline, block.palette.text);
      baseline -= lineHeight;
    }
    drawCentered(page, timeText, serif, fontSize - 0.5, centerX, baseline, block.palette.text);
    if (block.note) {
      baseline -= lineHeight;
      drawCentered(page, block.note, serif, fontSize - 0.5, centerX, baseline, block.palette.text);
    }
  }

  // Legende mit Icons
  let legendY = bodyBottom - 8;
  for (const row of legendRows) {
    let x = MARGIN;
    for (const { entry, label, width } of row) {
      drawRoundedRect(page, x, legendY, 12, 12, 3, entry.palette.bg, entry.palette.border, 0.6);
      drawIcon(page, entry.icon, x + 1.5, legendY - 1.5, 9, entry.palette.text, entry.palette.bg);
      page.drawText(label, {
        x: x + 17,
        y: legendY - 9,
        size: legendFontSize,
        font: regular,
        color: color(TEXT),
      });
      x += width;
    }
    legendY -= 17;
  }

  // Fussnoten
  let noteY = legendY - 2;
  for (const line of footnoteLines) {
    page.drawText(line, { x: MARGIN, y: noteY - 6, size: 7, font: regular, color: color(GRAY) });
    noteY -= 9;
  }

  return doc.save();
}
