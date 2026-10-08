import { MINIATURES } from "@/lib/miniatures";

export type HeroSlide =
  | { kind: "course"; slug: string; title: string; description: string; category: string }
  | {
      kind: "feature";
      label: string;
      title: string;
      text: string;
      image: string;
      // "warm": Sand-/Braunton statt Blau (fuer Fotos in warmen Farben)
      theme?: "warm";
      // Bild hat bereits eine eigene Perspektive (z. B. Foto von schraeg unten): nicht zusaetzlich kippen
      flat?: boolean;
      action: { type: "link"; href: string; cta: string } | { type: "booking" };
    };

// Slide 1: Einladung zur kostenlosen Erstberatung (Calendly-Link ueber BookingButton).
// Hintergrund: Stuckrelief der Alhambra in Sand-/Brauntoenen (Lizenzfoto, siehe MINIATURES.reliefHero).
export function bookingSlide(): HeroSlide {
  return {
    kind: "feature",
    label: "Online-Unterricht · live · persönlich",
    title: "Quran und islamisches Wissen lernen – für jeden zugänglich",
    text: "Nicht sicher, welcher Kurs passt? In einem kostenlosen, unverbindlichen Erstgespräch schauen wir gemeinsam, welches Angebot zu dir oder deinem Kind passt.",
    image: MINIATURES.reliefHero.src,
    theme: "warm",
    flat: true,
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
