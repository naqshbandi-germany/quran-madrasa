// Persische Miniaturen als Kurs-Grafiken. Die Bilder stammen von Wikimedia Commons
// (Gemaelde aus dem 15./16. Jahrhundert, gemeinfrei bzw. CC0) und liegen
// verkleinert unter public/images/miniatures/. Die Quellenangaben erscheinen auf
// der Seite /bildnachweis.

export type MiniatureKey = "quran" | "ghazali" | "shamail" | "fiqh" | "seelenlehre" | "quranHero" | "cornerOrnament";

export type Miniature = {
  key: MiniatureKey;
  src: string;
  // Bildausschnitt (CSS object-position bzw. background-position) fuer kleine Formate
  focus: string;
  title: string;
  work: string;
  origin: string;
  license: string;
  sourceUrl: string;
};

export const MINIATURES: Record<MiniatureKey, Miniature> = {
  quran: {
    key: "quran",
    src: "/images/miniatures/quran-school.jpg",
    focus: "50% 62%",
    title: "Laila und Madschnun in der Schule",
    work: "Blatt aus einer Khamsa (Quintett) des Nizami, 1431 (Timuridenzeit)",
    origin: "The Metropolitan Museum of Art, New York (1994.232.4)",
    license: "CC0 (Open Access)",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:%22Laila_and_Majnun_at_School%22,_Folio_from_a_Khamsa_(Quintet)_of_Nizami_MET_DP159399.jpg",
  },
  ghazali: {
    key: "ghazali",
    src: "/images/miniatures/ghazali-ascetic.jpg",
    focus: "50% 30%",
    title: "Rat des Asketen",
    work: "Kamal ud-Din Bihzad, Moraqqa'-e Golshan, erste Hälfte 16. Jahrhundert",
    origin: "Golestan-Palast, Teheran",
    license: "Gemeinfrei",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Behzad_advice_ascetic.jpg",
  },
  shamail: {
    key: "shamail",
    src: "/images/miniatures/shamail-garden.jpg",
    focus: "50% 68%",
    title: "Der Dichter Sa'di im nächtlichen Gespräch mit einem jungen Freund im Garten",
    work: "Gulistan des Sa'di für Prinz Baysunghur, Herat, 1427",
    origin: "Chester Beatty Library, Dublin (CBL Per 119)",
    license: "Gemeinfrei",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:The_poet_Sa%27di_converses_by_night_with_a_young_friend_in_a_garden._Miniature_from_Gulistan_Sa%27di._Herat,_1427._Chester_Beatty_Library,_Dublin._f.3r.jpg",
  },
  fiqh: {
    key: "fiqh",
    src: "/images/miniatures/fiqh-mosque.jpg",
    focus: "50% 45%",
    title: "Bau der Großen Moschee von Samarkand",
    work: "Bihzad, Zafarnama des Sharaf ad-Din Ali Yazdi, um 1480",
    origin: "John Work Garrett Library, Johns Hopkins University, Baltimore",
    license: "Gemeinfrei",
    sourceUrl:
      "https://commons.wikimedia.org/wiki/File:Building_of_the_Great_Mosque_in_Samarkand_(right).jpg",
  },
  // Titelbild fuer Startseiten-Slide und Quran-Seite (kein Kurs-Motiv, siehe miniatureFor).
  quranHero: {
    key: "quranHero",
    src: "/images/hero/blue-quran.jpg",
    focus: "35% 45%",
    title: "Blatt aus dem „Blauen Quran“",
    work: "Gold und Silber auf indigogefärbtem Pergament, 2. Hälfte 9. bis Mitte 10. Jahrhundert",
    origin: "The Metropolitan Museum of Art, New York (2004.88)",
    license: "CC0 (Open Access)",
    sourceUrl: "https://www.metmuseum.org/art/collection/search/454662",
  },
  // Eck-Ornament der Quran-Seite (kein Kurs-Motiv, siehe miniatureFor).
  cornerOrnament: {
    key: "cornerOrnament",
    src: "/images/ornaments/corner.png",
    focus: "50% 50%",
    title: "Eck-Ornament (Gold, links oben)",
    work: "Antikes Eck-Ornament mit Blumenmotiven, Urheber unbekannt (Dingbat-Schrift), 2011",
    origin: "Wikimedia Commons",
    license: "CC0 (gemeinfrei)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Corner_Ornament_Gold_Up_Left.png",
  },
  seelenlehre: {
    key: "seelenlehre",
    src: "/images/miniatures/seelenlehre-dervish.jpg",
    focus: "50% 38%",
    title: "Porträt eines Derwischs",
    work: "Kamal ud-Din Bihzad, um 1500",
    origin: "Privatsammlung (Abbildung aus: Ebadollah Bahari, Bihzad)",
    license: "Gemeinfrei",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:Behzad_portrait_of_a_dervish.jpg",
  },
};

const KEY_BY_SLUG: Record<string, MiniatureKey> = {
  "imam-al-ghazali-kurs": "ghazali",
  "shamail-und-seerah": "shamail",
  "einstieg-fiqh-aqidah": "fiqh",
  "islamische-seelenlehre-charakterbildung": "seelenlehre",
};

// Alle Kurse rund um Quran, Rezitation und Hifz teilen sich die Schulszene.
const QURAN_CATEGORIES = new Set(["Quran-Rezitation", "Quran-Rezitation (Tadschwid)", "Hifz"]);

export function miniatureFor(course: { slug: string; category: string }): Miniature | null {
  const key = KEY_BY_SLUG[course.slug] ?? (QURAN_CATEGORIES.has(course.category) ? "quran" : null);
  return key ? MINIATURES[key] : null;
}
