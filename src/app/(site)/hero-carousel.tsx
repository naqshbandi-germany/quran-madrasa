"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { preload } from "react-dom";

import { BookingButton } from "@/components/booking-button";
import { OrnamentDivider } from "@/components/ornament";

export type HeroSlide =
  | { kind: "booking" }
  | { kind: "course"; slug: string; title: string; description: string; category: string }
  | {
      kind: "feature";
      label: string;
      title: string;
      text: string;
      href: string;
      cta: string;
      image: string;
    };

const AUTO_ADVANCE_MS = 6000;

// Ruhige, einfarbige Flaechen im Wechsel (tiefes Himmelblau / Dunkelgruen).
const BACKGROUNDS = ["bg-azure-800", "bg-brand-700", "bg-azure-800", "bg-brand-700"];

const OUTLINE_LINK =
  "inline-block rounded-md border border-gold-200 px-6 py-2.5 text-sm font-medium uppercase tracking-widest text-gold-200 transition hover:bg-gold-200 hover:text-azure-800";

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);

  // Bilder der Folien vorab laden, damit der Wechsel ohne Flackern klappt.
  for (const slide of slides) {
    if (slide.kind === "feature") preload(slide.image, { as: "image" });
  }

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
    <section className="relative overflow-hidden">
      <div
        className={`relative flex min-h-[26rem] flex-col items-center overflow-hidden px-6 py-14 text-center text-white transition-colors sm:min-h-[32rem] sm:px-12 ${slide.kind === "feature" ? "justify-start bg-azure-900 pt-16 sm:pt-20" : `justify-center ${background}`}`}
      >
        {slide.kind === "feature" && (
          <>
            {/* Seite des Manuskripts, schraeg von oben gesehen (Perspektive), mit Ken Burns */}
            <div aria-hidden="true" className="absolute inset-0 overflow-hidden [perspective:1000px]">
              <div
                key={index}
                className="absolute -left-[25%] bottom-[-22%] h-[210%] w-[150%] animate-kenburns bg-cover bg-center [transform-origin:50%_100%] [transform:rotateX(60deg)_scale(1.02)] motion-reduce:animate-none"
                style={{ backgroundImage: `url(${slide.image})` }}
              />
            </div>
            {/* Oben in Blau auslaufen und weich unscharf werden, damit die Schrift wirkt */}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-b from-azure-900 from-35% via-azure-900/85 via-55% to-azure-900/0"
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
          {slide.kind === "booking" && (
            <>
              <p className="text-xs uppercase tracking-[0.3em] text-gold-200">
                Online-Unterricht · live · persönlich
              </p>
              <OrnamentDivider className="mt-4" />
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
                Quran und islamisches Wissen lernen – für jeden zugänglich
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
          )}

          {slide.kind === "feature" && (
            <>
              <p className="text-xs uppercase tracking-[0.3em] text-gold-200">{slide.label}</p>
              <OrnamentDivider className="mt-4" />
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
                {slide.title}
              </h1>
              <p className="mt-4 max-w-2xl text-lg text-white/90">{slide.text}</p>
              <div className="mt-8">
                <Link href={slide.href} className={OUTLINE_LINK}>
                  {slide.cta}
                </Link>
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
