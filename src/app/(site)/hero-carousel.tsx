"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BookingButton } from "@/components/booking-button";
import { OrnamentDivider } from "@/components/ornament";

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

// Ruhige, einfarbige Flaechen im Wechsel (tiefes Himmelblau / Dunkelgruen).
const BACKGROUNDS = ["bg-azure-800", "bg-brand-700", "bg-azure-800", "bg-brand-700"];

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
  const background = BACKGROUNDS[index % BACKGROUNDS.length];

  return (
    <section className="relative overflow-hidden rounded-lg">
      <div
        className={`flex min-h-[22rem] flex-col items-center justify-center px-6 py-14 text-center text-white transition-colors sm:px-12 ${background}`}
      >
        {slide.kind === "booking" ? (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-gold-200">
              Online-Unterricht · live · persönlich
            </p>
            <OrnamentDivider className="mt-4" />
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Koran und islamisches Wissen lernen – für jeden zugänglich
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-white/85">
              Nicht sicher, welcher Kurs passt? In einem kostenlosen, unverbindlichen
              Erstgespräch schauen wir gemeinsam, welches Angebot zu dir oder deinem Kind passt.
            </p>
            <div className="mt-8">
              <BookingButton
                variant="secondary"
                className="!border-gold-200 !text-gold-200 hover:!bg-gold-200 hover:!text-azure-800"
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-gold-200">
              {slide.course.category}
            </p>
            <OrnamentDivider className="mt-4" />
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              {slide.course.title}
            </h1>
            <p className="mt-4 line-clamp-3 max-w-2xl text-lg text-white/85">
              {slide.course.description}
            </p>
            <div className="mt-8">
              <Link
                href={`/courses/${slide.course.slug}`}
                className="inline-block rounded-md border border-gold-200 px-6 py-2.5 text-sm font-medium uppercase tracking-widest text-gold-200 transition hover:bg-gold-200 hover:text-azure-800"
              >
                Jetzt anmelden
              </Link>
            </div>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Folie ${i + 1} anzeigen`}
              onClick={() => setIndex(i)}
              className={`h-2 w-2 rounded-full transition ${
                i === index ? "bg-gold-200" : "bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
