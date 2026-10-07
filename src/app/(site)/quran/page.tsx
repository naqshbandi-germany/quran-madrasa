import Image from "next/image";
import Link from "next/link";

import { BookingButton } from "@/components/booking-button";
import { CornerOrnament, OrnamentDivider } from "@/components/ornament";
import { formatPrice, formatSchedule } from "@/lib/course-labels";
import { MINIATURES } from "@/lib/miniatures";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Quran-Unterricht für alle Level – Quran Madrasa" };

// Die Terminanzeige haengt von der deutschen Sommer-/Winterzeit ab, daher stuendlich neu
// erzeugen.
export const revalidate = 3600;

const LEVEL_SLUGS = ["quran-level-1", "quran-level-2", "quran-level-3"];

// Hadith ueber den Lohn des Quranlesens (ueberliefert von Abdullah ibn Masud,
// at-Tirmidhi Nr. 2910). Deutsche Wiedergabe sinngemaess.
const HADITH = {
  main: "Wer einen Buchstaben aus dem Buch Allahs liest, dem wird dafür eine gute Tat gutgeschrieben, und jede gute Tat wird zehnfach vergolten.",
  note: "Ich sage nicht, dass „Alif Lām Mīm“ ein Buchstabe ist, sondern „Alif“ ist ein Buchstabe, „Lām“ ist ein Buchstabe und „Mīm“ ist ein Buchstabe.",
  source: "Hadith, überliefert von ʿAbdullāh ibn Masʿūd · at-Tirmidhī, Nr. 2910",
};

export default async function QuranPage() {
  const courses = await prisma.course.findMany({
    where: { isPublished: true, slug: { in: LEVEL_SLUGS } },
    include: { scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] } },
  });
  const levels = LEVEL_SLUGS.flatMap((slug) => courses.filter((c) => c.slug === slug));
  const image = MINIATURES.quranHero;

  return (
    <div className="space-y-14">
      <section className="text-center">
        <h1 className="text-4xl font-semibold text-brand-900 sm:text-5xl">
          Quran-Unterricht für alle Level
        </h1>
        <OrnamentDivider className="mx-auto mt-4" />
      </section>

      <figure className="relative mx-auto max-w-4xl bg-white px-8 py-16 text-center sm:px-24 sm:py-24">
        <CornerOrnament className="absolute left-3 top-3 sm:left-5 sm:top-5" />
        <CornerOrnament className="absolute right-3 top-3 rotate-90 sm:right-5 sm:top-5" />
        <CornerOrnament className="absolute bottom-3 right-3 rotate-180 sm:bottom-5 sm:right-5" />
        <CornerOrnament className="absolute bottom-3 left-3 -rotate-90 sm:bottom-5 sm:left-5" />

        <blockquote>
          <p className="font-display text-2xl font-medium italic leading-snug text-brand-900 sm:text-4xl">
            „{HADITH.main}“
          </p>
          <p className="mt-8 font-display text-lg italic text-brand-900/70 sm:text-xl">
            {HADITH.note}
          </p>
        </blockquote>
        <figcaption className="mt-8 text-xs uppercase tracking-[0.18em] text-azure-700">
          {HADITH.source}
        </figcaption>
      </figure>

      <section className="grid items-center gap-8 md:grid-cols-[18rem_1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-md border border-brand-200 bg-brand-100 shadow-sm">
          <Image
            src={image.src}
            alt={image.title}
            fill
            sizes="288px"
            className="object-cover"
            style={{ objectPosition: image.focus }}
          />
        </div>
        <div>
          <h2 className="text-3xl font-semibold text-brand-900 sm:text-4xl">
            Schritt für Schritt zur fließenden Rezitation
          </h2>
          <OrnamentDivider className="mt-3" />
          <div className="mt-4 max-w-2xl space-y-3 text-brand-900/85">
            <p>
              Unsere Quran-Kurse begleiten dich vom ersten Buchstaben bis zur fließenden
              Rezitation: Du lernst das arabische Schriftbild (Qaidah), liest die meistgelesenen
              Passagen und Surahs, übst die wichtigsten Tajwid-Regeln und lernst ausgewählte
              Surahs und Duas auswendig, mit regelmäßiger Wiederholung.
            </p>
            <p>
              Die drei Level bauen aufeinander auf. Der Unterricht findet live online statt, in
              Einheiten von etwa 45 Minuten, mehrmals pro Woche. Die Kurse sind für Kinder,
              Jugendliche und Erwachsene geeignet.
            </p>
          </div>
        </div>
      </section>

      {levels.length > 0 && (
        <section>
          <h2 className="text-center text-3xl font-semibold text-brand-900">Unsere drei Level</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {levels.map((course) => (
              <article
                key={course.id}
                className="flex flex-col rounded-md border border-t-[3px] border-brand-200 border-t-azure-700 bg-white p-6 shadow-sm"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-azure-700">
                  {course.level ?? "Quran"}
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold leading-snug text-brand-900">
                  {course.title}
                </h3>
                <p className="mt-2 text-sm text-brand-900/75">{course.description}</p>

                {course.scheduleSlots.length > 0 && (
                  <p className="mt-3 text-xs text-brand-900/75">
                    <span className="mr-1.5 rounded-full border border-azure-700/30 px-2 py-0.5 font-medium text-azure-800">
                      {course.scheduleSlots.length}× / Woche
                    </span>
                    {formatSchedule(course.scheduleSlots)}
                  </p>
                )}

                <div className="mt-auto pt-5">
                  <p className="mb-3 text-sm font-semibold text-brand-700">
                    {course.priceCents > 0
                      ? `${formatPrice(course.priceCents, course.currency)} / Monat`
                      : "Preis auf Anfrage"}
                  </p>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="inline-block rounded-md border border-azure-800 px-4 py-2 text-sm font-medium text-azure-800 transition hover:bg-azure-800 hover:text-white"
                  >
                    Zum Kurs
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-md border border-brand-200 bg-white p-6 text-center">
        <p className="mb-3 text-brand-900/80">
          Nicht sicher, welches Level passt? Lass uns das in einem kurzen, kostenlosen Gespräch
          klären.
        </p>
        <BookingButton />
      </div>
    </div>
  );
}
