import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { WEEKDAY_LABELS } from "@/lib/course-labels";
import { formatHour, type Timetable } from "@/lib/timetable";

const NAVY = "#14325c";
const CREAM = "#fdf6e3";
const GRID_LINE = "#e6dcc0";
const GRAY = "#5b6470";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const TIME_COLUMN_WIDTH = 56;
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
  fill: string,
  border: string,
) {
  page.drawSvgPath(roundedRectPath(w, h, radius), {
    x,
    y: topY,
    color: color(fill),
    borderColor: color(border),
    borderWidth: 0.8,
  });
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
  const { days, hourMarks, gridStart, gridEnd, blocks, legend, footnotes } = timetable;

  const doc = await PDFDocument.create();
  doc.setTitle("Wöchentlicher Stundenplan");
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const contentWidth = PAGE_WIDTH - 2 * MARGIN;

  drawCentered(page, "WÖCHENTLICHER STUNDENPLAN", bold, 24, PAGE_WIDTH / 2, PAGE_HEIGHT - 52, NAVY);

  const subtitle = pdfSafe("UNTERRICHT & VERFÜGBARKEIT");
  const letterSpacing = 3;
  const subtitleWidth =
    [...subtitle].reduce((sum, ch) => sum + regular.widthOfTextAtSize(ch, 10) + letterSpacing, 0) -
    letterSpacing;
  let subtitleX = (PAGE_WIDTH - subtitleWidth) / 2;
  for (const ch of subtitle) {
    page.drawText(ch, { x: subtitleX, y: PAGE_HEIGHT - 70, size: 10, font: regular, color: color(NAVY) });
    subtitleX += regular.widthOfTextAtSize(ch, 10) + letterSpacing;
  }

  const stand = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "medium",
  }).format(new Date());
  const footnoteLines = [
    ...footnotes.flatMap((note) => wrapText(note, regular, 7, contentWidth)),
    `Stand: ${stand}`,
  ];

  // Legende: Zeilenumbruch, falls die Eintraege nicht in eine Zeile passen.
  const legendFontSize = 7.5;
  const legendItems = legend.map((entry) => {
    const label = pdfSafe(entry.label);
    return { entry, label, width: 14 + regular.widthOfTextAtSize(label, legendFontSize) + 16 };
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
  const legendHeight = legendRows.length * 15 + 6;
  const gridTop = PAGE_HEIGHT - 84;
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
    color: color(CREAM),
    borderColor: color(NAVY),
    borderWidth: 1.5,
  });
  drawCentered(page, "Uhrzeit", bold, 8, MARGIN + TIME_COLUMN_WIDTH / 2, bodyTop + 15, "#ffffff");
  drawCentered(
    page,
    "(deutsche Zeit)",
    regular,
    6.5,
    MARGIN + TIME_COLUMN_WIDTH / 2,
    bodyTop + 6,
    "#cbd5e1",
  );
  days.forEach((day, i) => {
    drawCentered(
      page,
      WEEKDAY_LABELS[day] ?? day,
      bold,
      11,
      gridLeft + i * dayWidth + dayWidth / 2,
      bodyTop + 9,
      "#ffffff",
    );
  });

  // Stundenlinien, Uhrzeiten und Tagestrenner
  for (const mark of hourMarks) {
    const y = yOf(mark);
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + contentWidth, y },
      thickness: 0.5,
      color: color(GRID_LINE),
    });
    if (mark < gridEnd) {
      page.drawText(formatHour(mark), {
        x: MARGIN + 10,
        y: y - 10,
        size: 8,
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
      color: color(GRID_LINE),
    });
  }

  // Kurs-Bloecke
  for (const block of blocks) {
    const dayIndex = days.indexOf(block.weekday);
    if (dayIndex === -1) continue;

    const x = gridLeft + dayIndex * dayWidth + 3;
    const width = dayWidth - 6;
    const top = yOf(block.startMinutes) - 1.5;
    const height = top - (yOf(block.endMinutes) + 1.5);
    drawRoundedRect(page, x, top, width, height, 4, block.palette.bg, block.palette.border);

    const title = `${block.shortTitle}${block.marked ? "*" : ""}`;
    const timeText = `${block.startTime} – ${block.endTime}`;
    let fontSize = 8;
    let titleLines = wrapText(title, bold, fontSize, width - 8);
    let lineCount = titleLines.length + 1 + (block.note ? 1 : 0);
    if (lineCount * (fontSize + 2) > height - 4) {
      fontSize = 7;
      titleLines = wrapText(title, bold, fontSize, width - 8);
      lineCount = titleLines.length + 1 + (block.note ? 1 : 0);
    }
    const lineHeight = fontSize + 2;
    let baseline = top - (height - lineCount * lineHeight) / 2 - fontSize;
    for (const line of titleLines) {
      drawCentered(page, line, bold, fontSize, x + width / 2, baseline, block.palette.text);
      baseline -= lineHeight;
    }
    drawCentered(page, timeText, regular, fontSize, x + width / 2, baseline, block.palette.text);
    if (block.note) {
      baseline -= lineHeight;
      drawCentered(page, block.note, regular, fontSize, x + width / 2, baseline, block.palette.text);
    }
  }

  // Legende
  let legendY = bodyBottom - 6;
  for (const row of legendRows) {
    let x = MARGIN;
    for (const { entry, label, width } of row) {
      drawRoundedRect(page, x, legendY, 10, 10, 2, entry.palette.bg, entry.palette.border);
      page.drawText(label, {
        x: x + 14,
        y: legendY - 8,
        size: legendFontSize,
        font: regular,
        color: color(NAVY),
      });
      x += width;
    }
    legendY -= 15;
  }

  // Fussnoten
  let noteY = legendY - 4;
  for (const line of footnoteLines) {
    page.drawText(line, { x: MARGIN, y: noteY - 6, size: 7, font: regular, color: color(GRAY) });
    noteY -= 9;
  }

  return doc.save();
}
