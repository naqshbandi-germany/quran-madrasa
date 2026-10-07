"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BookingButton } from "@/components/booking-button";

export type CourseSlideData = {
  slug: string;
  title: string;
  description: string;
  category: string;
};

type Slide =
  | { kind: "booking" }
  | { kind: "course"; course: CourseSlideData };

const AUTO_ADVANCE_MS = 6000;

// Farbverlaeufe pro Slide-Index, rein funktional/Platzhalter - das finale
// Design (echte Bilder etc.) kommt spaeter.
const GRADIENTS = [
  "from-azure-700 to-brand-700",
  "from-brand-600 to-azure-800",
  "from-azure-800 to-brand-600",
  "from-brand-700 to-azure-700",
];

export function HeroCarousel({ courses }: { courses: CourseSlideData[] }) {
  const slides: Slide[] = [{ kind: "booking" }, ...courses.map((course) => ({ kind: "course" as const, course }))];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  const slide = slides[index];
  const gradient = GRADIENTS[index % GRADIENTS.length];

  return (
    <section className="relative overflow-hidden rounded-xl border-2 border-gold-400 shadow-sm">
      <div className={`bg-gradient-to-br ${gradient} px-6 py-10 text-white transition-colors sm:px-10`}>
        {slide.kind === "booking" ? (
          <>
            <h1 className="text-3xl font-bold sm:text-4xl">
              Online Koran-Unterricht – live, persönlich, für jeden zugänglich
            </h1>
            <p className="mt-3 max-w-2xl text-white/90">
              Nicht sicher, welcher Kurs passt? In einem kostenlosen, unverbindlichen
              Erstgespräch schauen wir gemeinsam, welches Angebot zu dir oder deinem Kind passt.
            </p>
            <div className="mt-6">
              <BookingButton
                variant="secondary"
                className="!border-white !text-white hover:!bg-white hover:!text-brand-700"
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium uppercase tracking-wide text-white/80">
              {slide.course.category}
            </p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{slide.course.title}</h1>
            <p className="mt-3 max-w-2xl text-white/90">{slide.course.description}</p>
            <div className="mt-6">
              <Link
                href={`/courses/${slide.course.slug}`}
                className="inline-block rounded-md bg-white px-5 py-2.5 font-medium text-brand-700 transition hover:bg-brand-50"
              >
                Jetzt anmelden
              </Link>
            </div>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-4 right-6 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Folie ${i + 1} anzeigen`}
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full transition ${
                i === index ? "bg-white" : "bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
