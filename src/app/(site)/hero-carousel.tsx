"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { preload } from "react-dom";

import { BookingButton } from "@/components/booking-button";
import { OrnamentDivider } from "@/components/ornament";
import type { HeroPerspective, HeroSlide } from "@/lib/hero-slides";

const AUTO_ADVANCE_MS = 6000;

// Ruhige, einfarbige Flaechen im Wechsel (tiefes Himmelblau / Dunkelgruen) fuer Kurs-Slides.
const BACKGROUNDS = ["bg-azure-800", "bg-brand-700", "bg-azure-800", "bg-brand-700"];

const OUTLINE_LINK =
  "inline-block rounded-md border border-gold-200 px-6 py-2.5 text-sm font-medium uppercase tracking-widest text-gold-200 transition hover:bg-gold-200 hover:text-azure-800";

// Lage der Bildebene. Die Ken-Burns-Animation (tailwind.config.ts) startet jeweils aus
// derselben Lage. "side": Seite zusaetzlich in der Ebene gedreht (Zeilen steigen nach rechts
// an) und seitlich gekippt (rechts nah, nach links oben in der Ferne).
const PLANE_CLASSES: Record<HeroPerspective, string> = {
  center: "-left-[25%] bottom-[-26%] h-[210%] w-[150%] animate-kenburns [transform:rotateX(60deg)_scale(1.02)]",
  side: "-left-[45%] bottom-[-50%] h-[270%] w-[200%] animate-kenburns-side [transform:rotateX(55deg)_rotateY(-20deg)_rotateZ(-10deg)_scale(1.02)]",
};

export function HeroCarousel({
  slides,
  autoAdvance = true,
}: {
  slides: HeroSlide[];
  autoAdvance?: boolean;
}) {
  const [index, setIndex] = useState(0);

  // Bilder der Folien vorab laden, damit der Wechsel ohne Flackern klappt.
  for (const slide of slides) {
    if (slide.kind === "feature") preload(slide.image, { as: "image" });
  }

  useEffect(() => {
    if (!autoAdvance || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [autoAdvance, slides.length]);

  const slide = slides[index];
  const background = BACKGROUNDS[index % BACKGROUNDS.length];

  return (
    <section className="relative overflow-hidden">
      <div
        className={`relative flex min-h-[28rem] flex-col items-center overflow-hidden px-6 py-14 text-center text-white transition-colors sm:min-h-[37rem] sm:px-12 ${slide.kind === "feature" ? "justify-start bg-azure-900 pt-16 sm:pt-20" : `justify-center ${background}`}`}
      >
        {slide.kind === "feature" && (
          <>
            {/* Bild als Seite eines aufgeschlagenen Buchs in Perspektive, mit Ken Burns */}
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden [perspective:1000px]">
              <div
                key={`${index}-${slide.perspective}`}
                className={`absolute bg-cover bg-center [transform-origin:50%_100%] motion-reduce:animate-none ${PLANE_CLASSES[slide.perspective]}`}
                style={{ backgroundImage: `url(${slide.image})` }}
              />
            </div>
            {/* Unten leicht abdunkeln, damit helle Bilder (Stundenplan) nicht ausbrennen */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-azure-900/20 via-transparent to-transparent"
            />
            {/* Oben in Blau auslaufen und weich unscharf werden, damit die Schrift wirkt */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-azure-900 from-38% via-azure-900/85 via-58% to-azure-900/0"
            />
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 h-3/4 backdrop-blur-sm"
              style={{
                maskImage: "linear-gradient(to bottom, black 20%, transparent)",
                WebkitMaskImage: "linear-gradient(to bottom, black 20%, transparent)",
              }}
            />
          </>
        )}

        <div className="relative flex flex-col items-center">
          {slide.kind === "feature" && (
            <>
              <p className="text-xs uppercase tracking-[0.3em] text-gold-200">{slide.label}</p>
              <OrnamentDivider className="mt-4" />
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
                {slide.title}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-white/90">{slide.text}</p>
              <div className="mt-8">
                {slide.action.type === "booking" ? (
                  <BookingButton
                    variant="secondary"
                    className="!border-gold-200 !text-gold-200 hover:!bg-gold-200 hover:!text-azure-800"
                  />
                ) : (
                  <Link href={slide.action.href} className={OUTLINE_LINK}>
                    {slide.action.cta}
                  </Link>
                )}
              </div>
            </>
          )}

          {slide.kind === "course" && (
            <>
              <p className="text-xs uppercase tracking-[0.3em] text-gold-200">{slide.category}</p>
              <OrnamentDivider className="mt-4" />
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
                {slide.title}
              </h1>
              <p className="mt-4 line-clamp-3 max-w-2xl text-lg text-white/85">
                {slide.description}
              </p>
              <div className="mt-8">
                <Link href={`/courses/${slide.slug}`} className={OUTLINE_LINK}>
                  Jetzt anmelden
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Folie ${i + 1} anzeigen`}
              aria-current={i === index}
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
