import {
  LineCapStyle,
  PDFDocument,
  StandardFonts,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";

import { WEEKDAY_LABELS } from "@/lib/course-labels";
import { formatClock, type Timetable } from "@/lib/timetable";
import {
  ICONS,
  SKYLINE_COLOR,
  SKYLINE_LEFT,
  SKYLINE_RIGHT,
  SKYLINE_SIZE,
  type IconName,
} from "@/lib/timetable-art";

const NAVY = "#14325c";
const GOLD = "#c9a85c";
const CREAM = "#fdf6e3";
const HOUR_LINE = "#dccfa9";
const HALF_HOUR_LINE = "#efe6cc";
const GRAY = "#5b6470";

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const MARGIN = 28;
const TIME_COLUMN_WIDTH = 56;
const HEADER_HEIGHT = 26;
const SKYLINE_HEIGHT = 44;

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

function drawSkyline(page: PDFPage, parts: string[], x: number, topY: number) {
  const scale = SKYLINE_HEIGHT / SKYLINE_SIZE.height;
  for (const d of parts) {
    page.drawSvgPath(d, { x, y: topY, scale, color: color(SKYLINE_COLOR) });
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

// Zeichnet ein Bild wie CSS "object-fit: cover" in den Kasten, zugeschnitten am Rand.
function drawImageCover(
  page: PDFPage,
  image: PDFImage,
  box: { x: number; top: number; width: number; height: number },
  focus: string,
  opacity: number,
) {
  const [fx, fy] = focus.split(" ").map((p) => parseFloat(p) / 100);
  const scale = Math.max(box.width / image.width, box.height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const imageLeft = box.x + (box.width - drawWidth) * fx;
  const imageTop = box.top + (box.height - drawHeight) * fy;

  page.pushOperators(
    pushGraphicsState(),
    rectangle(box.x, box.top - box.height, box.width, box.height),
    clip(),
    endPath(),
  );
  page.drawImage(image, {
    x: imageLeft,
    y: imageTop - drawHeight,
    width: drawWidth,
    height: drawHeight,
    opacity,
  });
  page.pushOperators(popGraphicsState());
}

// images: JPEG-Daten der Miniaturen, Schluessel ist der Bildpfad (Miniature.src).
export async function renderTimetablePdf(
  timetable: Timetable,
  images: Record<string, Uint8Array> = {},
): Promise<Uint8Array> {
  const { days, timeMarks, gridStart, gridEnd, blocks, legend, footnotes } = timetable;

  const doc = await PDFDocument.create();
  const embeddedImages = new Map<string, PDFImage>();
  doc.setTitle("Wöchentlicher Stundenplan");
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const contentWidth = PAGE_WIDTH - 2 * MARGIN;

  // Doppelter Rahmen (dunkelblau + gold) um die ganze Seite
  drawRoundedRect(page, 12, PAGE_HEIGHT - 12, PAGE_WIDTH - 24, PAGE_HEIGHT - 24, 10, null, NAVY, 2.2);
  drawRoundedRect(page, 16.5, PAGE_HEIGHT - 16.5, PAGE_WIDTH - 33, PAGE_HEIGHT - 33, 7, null, GOLD, 0.8);

  const gridTop = PAGE_HEIGHT - 84;

  // Kopfbereich: Silhouetten links/rechts, Titel in der Mitte
  const skylineWidth = (SKYLINE_SIZE.width / SKYLINE_SIZE.height) * SKYLINE_HEIGHT;
  drawSkyline(page, SKYLINE_LEFT, MARGIN, gridTop + SKYLINE_HEIGHT + 3);
  drawSkyline(page, SKYLINE_RIGHT, PAGE_WIDTH - MARGIN - skylineWidth, gridTop + SKYLINE_HEIGHT + 3);

  drawCentered(page, "WÖCHENTLICHER STUNDENPLAN", serifBold, 24, PAGE_WIDTH / 2, PAGE_HEIGHT - 50, NAVY);

  const subtitle = pdfSafe("UNTERRICHT & VERFÜGBARKEIT");
  const letterSpacing = 3;
  const subtitleWidth =
    [...subtitle].reduce((sum, ch) => sum + regular.widthOfTextAtSize(ch, 10) + letterSpacing, 0) -
    letterSpacing;
  let subtitleX = (PAGE_WIDTH - subtitleWidth) / 2;
  for (const ch of subtitle) {
    page.drawText(ch, { x: subtitleX, y: PAGE_HEIGHT - 68, size: 10, font: regular, color: color(NAVY) });
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
    return { entry, label, width: 18 + regular.widthOfTextAtSize(label, legendFontSize) + 16 };
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
  drawCentered(page, "Uhrzeit", regular, 8, MARGIN + TIME_COLUMN_WIDTH / 2, bodyTop + 15, "#ffffff");
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
        x: MARGIN + 12,
        y: y - 9,
        size: 7.5,
        font: regular,
        color: color(NAVY),
      });
    }
  }
  for (let i = 0; i <= days.length; i++) {
    const x = gridLeft + i * dayWidth;
    page.drawLine({
      start: { x, y: bodyTop },
      end: { x, y: bodyBottom },
      thickness: 0.5,
      color: color(HOUR_LINE),
    });
  }

  // Kurs-Bloecke: Icon links, Text rechts daneben (wie in der Vorlagen-Grafik)
  const ICON_SIZE = 15;
  for (const block of blocks) {
    const dayIndex = days.indexOf(block.weekday);
    if (dayIndex === -1) continue;

    const x = gridLeft + dayIndex * dayWidth + 3;
    const width = dayWidth - 6;
    const top = yOf(block.startMinutes) - 1.5;
    const height = top - (yOf(block.endMinutes) + 1.5);
    drawRoundedRect(page, x, top, width, height, 4, block.palette.bg, block.palette.border);

    const imageBytes = block.miniature ? images[block.miniature.src] : undefined;
    if (block.miniature && imageBytes) {
      let image = embeddedImages.get(block.miniature.src);
      if (!image) {
        image = await doc.embedJpg(imageBytes);
        embeddedImages.set(block.miniature.src, image);
      }
      drawImageCover(
        page,
        image,
        { x: x + width * 0.45, top: top - 1, width: width * 0.55 - 1, height: height - 2 },
        block.miniature.focus,
        0.38,
      );
    }

    drawIcon(page, block.icon, x + 5, top - 6, ICON_SIZE, block.palette.text, block.palette.bg);

    const textLeft = x + 5 + ICON_SIZE + 4;
    const textWidth = width - (5 + ICON_SIZE + 4) - 4;
    const title = `${block.shortTitle}${block.marked ? "*" : ""}`;
    const timeText = `${block.startTime} – ${block.endTime}`;
    let fontSize = 9;
    let titleLines = wrapText(title, serifBold, fontSize, textWidth);
    let lineCount = titleLines.length + 1 + (block.note ? 1 : 0);
    if (lineCount * (fontSize + 2) > height - 8) {
      fontSize = 7.5;
      titleLines = wrapText(title, serifBold, fontSize, textWidth);
      lineCount = titleLines.length + 1 + (block.note ? 1 : 0);
    }
    const lineHeight = fontSize + 2;
    let baseline = top - 6 - fontSize + 1;
    for (const line of titleLines) {
      page.drawText(line, {
        x: textLeft,
        y: baseline,
        size: fontSize,
        font: serifBold,
        color: color(block.palette.text),
      });
      baseline -= lineHeight;
    }
    page.drawText(timeText, {
      x: textLeft,
      y: baseline,
      size: fontSize - 0.5,
      font: serif,
      color: color(block.palette.text),
    });
    if (block.note) {
      baseline -= lineHeight;
      page.drawText(pdfSafe(block.note), {
        x: textLeft,
        y: baseline,
        size: fontSize - 0.5,
        font: serif,
        color: color(block.palette.text),
      });
    }
  }

  // Legende mit Icons
  let legendY = bodyBottom - 6;
  for (const row of legendRows) {
    let x = MARGIN;
    for (const { entry, label, width } of row) {
      drawRoundedRect(page, x, legendY, 12, 12, 3, entry.palette.bg, entry.palette.border);
      drawIcon(page, entry.icon, x + 1.5, legendY - 1.5, 9, entry.palette.text, entry.palette.bg);
      page.drawText(label, {
        x: x + 17,
        y: legendY - 9,
        size: legendFontSize,
        font: regular,
        color: color(NAVY),
      });
      x += width;
    }
    legendY -= 17;
  }

  // Fussnoten
  let noteY = legendY - 4;
  for (const line of footnoteLines) {
    page.drawText(line, { x: MARGIN, y: noteY - 6, size: 7, font: regular, color: color(GRAY) });
    noteY -= 9;
  }

  return doc.save();
}
