export type HeroPerspective = "center" | "side";

export type HeroSlide =
  | { kind: "course"; slug: string; title: string; description: string; category: string }
  | {
      kind: "feature";
      label: string;
      title: string;
      text: string;
      image: string;
      // "center": Seite liegt mittig, schraeg von oben gesehen; "side": zusaetzlich seitlich
      // gedreht (rechts nah, nach links oben in der Ferne).
      perspective: HeroPerspective;
      action: { type: "link"; href: string; cta: string } | { type: "booking" };
    };

// Slide 1: Einladung zur kostenlosen Erstberatung (Calendly-Link ueber BookingButton).
export function bookingSlide(perspective: HeroPerspective): HeroSlide {
  return {
    kind: "feature",
    label: "Online-Unterricht · live · persönlich",
    title: "Quran und islamisches Wissen lernen – für jeden zugänglich",
    text: "Nicht sicher, welcher Kurs passt? In einem kostenlosen, unverbindlichen Erstgespräch schauen wir gemeinsam, welches Angebot zu dir oder deinem Kind passt.",
    image: "/images/hero/stundenplan.jpg",
    perspective,
    action: { type: "booking" },
  };
}

// Slide 2: Quran-Unterricht fuer alle Level (fuehrt zur Quran-Unterseite).
export function quranSlide(perspective: HeroPerspective): HeroSlide {
  return {
    kind: "feature",
    label: "Quran-Unterricht",
    title: "Quran-Unterricht für alle Level",
    text: "Von den Grundlagen zur fließenden Rezitation & Auswendiglernen des Qurans mit Wiederholung.",
    image: "/images/hero/blue-quran.jpg",
    perspective,
    action: { type: "link", href: "/quran", cta: "Zum Quran-Unterricht" },
  };
}
