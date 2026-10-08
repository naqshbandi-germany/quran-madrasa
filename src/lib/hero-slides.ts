export type HeroSlide =
  | { kind: "course"; slug: string; title: string; description: string; category: string }
  | {
      kind: "feature";
      label: string;
      title: string;
      text: string;
      image: string;
      // Freigestellte Figur im Vordergrund (nur auf breiten Bildschirmen sichtbar)
      figure?: "thinking-man";
      action: { type: "link"; href: string; cta: string } | { type: "booking" };
    };

// Bildmotive fuer Slide 1 (Einladung zur kostenlosen Erstberatung).
export type BookingMotif = "stundenplan" | "teppich" | "labyrinth";

const BOOKING_MOTIFS: Record<BookingMotif, Pick<Extract<HeroSlide, { kind: "feature" }>, "image" | "figure">> = {
  stundenplan: { image: "/images/hero/stundenplan.jpg" },
  teppich: { image: "/images/hero/teppich.jpg" },
  labyrinth: { image: "/images/hero/labyrinth.jpg", figure: "thinking-man" },
};

// Slide 1: Einladung zur kostenlosen Erstberatung (Calendly-Link ueber BookingButton).
export function bookingSlide(motif: BookingMotif = "stundenplan"): HeroSlide {
  return {
    kind: "feature",
    label: "Online-Unterricht · live · persönlich",
    title: "Quran und islamisches Wissen lernen – für jeden zugänglich",
    text: "Nicht sicher, welcher Kurs passt? In einem kostenlosen, unverbindlichen Erstgespräch schauen wir gemeinsam, welches Angebot zu dir oder deinem Kind passt.",
    ...BOOKING_MOTIFS[motif],
    action: { type: "booking" },
  };
}

// Slide 2: Quran-Unterricht fuer alle Level (fuehrt zur Quran-Unterseite).
export function quranSlide(): HeroSlide {
  return {
    kind: "feature",
    label: "Quran-Unterricht",
    title: "Quran-Unterricht für alle Level",
    text: "Von den Grundlagen zur fließenden Rezitation & Auswendiglernen des Qurans mit Wiederholung.",
    image: "/images/hero/blue-quran.jpg",
    action: { type: "link", href: "/quran", cta: "Zum Quran-Unterricht" },
  };
}
