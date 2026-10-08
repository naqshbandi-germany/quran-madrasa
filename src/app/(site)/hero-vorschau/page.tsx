import { bookingSlide, type HeroSlide } from "@/lib/hero-slides";
import { HeroCarousel } from "../hero-carousel";

// Temporaere Vergleichsseite fuer die Motive von Slide 1; wird nach der Entscheidung entfernt.
export const metadata = { title: "Hero-Vorschau", robots: { index: false, follow: false } };

const VARIANTS: { label: string; slide: HeroSlide }[] = [
  { label: "Slide 1 (Beratung) · A: Stundenplan", slide: bookingSlide("stundenplan") },
  { label: "Slide 1 (Beratung) · B: Teppich mit Blütenranken", slide: bookingSlide("teppich") },
  { label: "Slide 1 (Beratung) · C: Kufi-Labyrinth mit Fragezeichen", slide: bookingSlide("labyrinth") },
];

export default function HeroPreviewPage() {
  return (
    <div className="space-y-10">
      <h1 className="text-3xl font-semibold text-brand-900">Hero-Vorschau</h1>
      {VARIANTS.map(({ label, slide }) => (
        <section key={label} className="space-y-3">
          <h2 className="text-xl font-semibold text-brand-900">{label}</h2>
          <div className="relative left-1/2 w-screen -translate-x-1/2">
            <HeroCarousel slides={[slide]} autoAdvance={false} />
          </div>
        </section>
      ))}
    </div>
  );
}
