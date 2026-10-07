// Gemeinsame Zeichen-Daten fuer Webseite und PDF: Kurs-Icons (24x24-Raster) und
// die Silhouetten im Kopfbereich. Reine SVG-Pfade, damit beide Ausgaben dieselben
// Formen nutzen.

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
  // Aufgeschlagener Koran auf dem X-foermigen Buchstaender
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

export const SKYLINE_COLOR = "#cbd8e8";
export const SKYLINE_SIZE = { width: 240, height: 64 };

// Silhouetten links (Kuppelbau, Minarett, Zypressen) und rechts (Berge, Minarette)
export const SKYLINE_LEFT = [
  "M24 64 V40 H88 V64 Z",
  "M32 40 C32 22 80 22 80 40 Z",
  "M55 14 H57 V26 H55 Z",
  "M100 64 V22 L104 10 L108 22 V64 Z",
  "M138 64 C129 46 133 26 140 6 C147 26 151 46 142 64 Z",
  "M160 64 C154 52 157 38 162 24 C167 38 170 52 164 64 Z",
  "M170 64 C192 50 216 50 240 58 V64 Z",
];

export const SKYLINE_RIGHT = [
  "M0 64 L38 26 L58 44 L92 12 L132 52 L156 38 L190 64 Z",
  "M196 64 V24 L200 12 L204 24 V64 Z",
  "M214 64 V30 L217 20 L220 30 V64 Z",
];
