// Gemeinsame Zeichen-Daten fuer Webseite und PDF: Kurs-Icons (24x24-Raster) als
// reine SVG-Pfade, damit beide Ausgaben dieselben Formen nutzen.

export type IconName = "quran" | "book" | "mosque";

// "main" = Textfarbe des Blocks, "bg" = Hintergrundfarbe (fuer Aussparungen).
export type IconPart = {
  d: string;
  mode: "fill" | "stroke";
  tone: "main" | "bg";
  width?: number;
};

const mirror = (d: string) =>
  // Spiegelt einen Pfad an der Mittelachse x=12 (nur absolute Befehle M/L/C/V/H/Z).
  d.replace(/([MLCVHZ])([^MLCVHZ]*)/g, (_, cmd: string, args: string) => {
    if (cmd === "V" || cmd === "Z") return `${cmd}${args}`;
    const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (cmd === "H") return `H${24 - nums[0]}`;
    const mirrored = nums.map((n, i) => (i % 2 === 0 ? 24 - n : n));
    return `${cmd}${mirrored.join(" ")} `;
  });

function openBook(top: number, bottom: number): IconPart[] {
  const leftPage = `M12 ${top + 1.5} C9.5 ${top} 6 ${top - 0.2} 3 ${top + 0.5} L3 ${bottom - 1} C6 ${bottom - 1.7} 9.5 ${bottom - 1.5} 12 ${bottom} Z`;
  const textLines = [0.25, 0.55, 0.85].map((f) => {
    const y = top + 3 + (bottom - top - 6) * f;
    return `M5.2 ${y} C6.9 ${y - 0.3} 8.8 ${y - 0.1} 10.2 ${y + 0.6}`;
  });
  return [
    { d: leftPage, mode: "fill", tone: "main" },
    { d: mirror(leftPage), mode: "fill", tone: "main" },
    { d: `M12 ${top + 1.5} V${bottom}`, mode: "stroke", tone: "bg", width: 0.9 },
    ...textLines.flatMap<IconPart>((line) => [
      { d: line, mode: "stroke", tone: "bg", width: 0.7 },
      { d: mirror(line), mode: "stroke", tone: "bg", width: 0.7 },
    ]),
  ];
}

export const ICONS: Record<IconName, IconPart[]> = {
  // Aufgeschlagener Quran auf dem X-foermigen Buchstaender
  quran: [
    ...openBook(3, 15),
    { d: "M6.5 21.5 L17.5 15.8", mode: "stroke", tone: "main", width: 1.8 },
    { d: "M17.5 21.5 L6.5 15.8", mode: "stroke", tone: "main", width: 1.8 },
  ],
  // Aufgeschlagenes Buch
  book: openBook(4.5, 20),
  // Moschee mit Kuppel, Eingang und zwei Minaretten
  mosque: [
    { d: "M5.5 14 C5.5 9.5 8.5 7 12 7 C15.5 7 18.5 9.5 18.5 14 Z", mode: "fill", tone: "main" },
    { d: "M12 7 V4.2", mode: "stroke", tone: "main", width: 1.3 },
    { d: "M12 1.8 L13.2 3.4 L12 5 L10.8 3.4 Z", mode: "fill", tone: "main" },
    { d: "M6 14 H18 V21.5 H6 Z", mode: "fill", tone: "main" },
    { d: "M10.3 21.5 V18.2 C10.3 16.4 13.7 16.4 13.7 18.2 V21.5 Z", mode: "fill", tone: "bg" },
    { d: "M2.2 21.5 V10.5 L3.6 8.5 L5 10.5 V21.5 Z", mode: "fill", tone: "main" },
    { d: "M19 21.5 V10.5 L20.4 8.5 L21.8 10.5 V21.5 Z", mode: "fill", tone: "main" },
  ],
};
