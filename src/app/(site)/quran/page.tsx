import Image from "next/image";
import Link from "next/link";

import { BookingButton } from "@/components/booking-button";
import { OrnamentDivider } from "@/components/ornament";
import { formatPrice, formatSchedule } from "@/lib/course-labels";
import { MINIATURES } from "@/lib/miniatures";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Quran-Unterricht für alle Level – Quran Madrasa" };

// Die Terminanzeige haengt von der deutschen Sommer-/Winterzeit ab, daher stuendlich neu
// erzeugen.
export const revalidate = 3600;

const LEVEL_SLUGS = ["quran-level-1", "quran-level-2", "quran-level-3"];

// Zitat von Maulana Sheikh Muhammad Adil Ar-Rabbani (Originalwortlaut, Englisch).
const QUOTE = {
  text: "Our Prophet says that for each letter of the Qur’ān there are ten rewards. Each word may have three letters, five letters, or seven letters. For each of those letters, there are ten rewards. Not only ten rewards, but also the forgiveness of ten sins and an elevation of ten degrees.",
  author: "Maulana Sheikh Muhammad Adil Ar-Rabbani",
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
        <h1 className="text-4xl font-semibold text-azure-800 sm:text-5xl">
          Quran-Unterricht für alle Level
        </h1>
        <OrnamentDivider className="mx-auto mt-4" />
      </section>

      {/* Zitat ohne Hintergrund, oben und unten von einer dezenten Goldlinie gefasst */}
      <figure className="border-y border-gold-400/60 px-6 py-16 text-center sm:px-28 sm:py-[4.5rem]">

        <blockquote>
          <p lang="en" className="mx-auto max-w-3xl font-quote text-2xl italic leading-relaxed text-azure-800 sm:text-3xl sm:leading-relaxed">
            „{QUOTE.text}“
          </p>
        </blockquote>
        <figcaption className="mt-10 text-xs uppercase tracking-[0.14em] text-gold-600 sm:text-sm sm:tracking-[0.2em]">
          {QUOTE.author}
        </figcaption>
      </figure>

      <section className="grid items-center gap-8 md:grid-cols-[18rem_1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden border border-gold-400/40 bg-brand-100">
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
          <h2 className="text-3xl font-semibold text-azure-800 sm:text-4xl">
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
          <h2 className="text-center text-3xl font-semibold text-azure-800">Unsere drei Level</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            {levels.map((course) => (
              <article
                key={course.id}
                className="flex flex-col border border-gold-400/40 bg-white p-6"
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-gold-600">
                  {course.level ?? "Quran"}
                </p>
                <h3 className="mt-1 font-display text-2xl font-semibold leading-snug text-azure-800">
                  {course.title}
                </h3>
                <p className="mt-2 text-sm text-brand-900/75">{course.description}</p>

                {course.scheduleSlots.length > 0 && (
                  <p className="mt-3 text-xs text-brand-900/75">
                    <span className="mr-1.5 rounded-full border border-gold-400/60 px-2 py-0.5 font-medium text-azure-800">
                      {course.scheduleSlots.length}× / Woche
                    </span>
                    {formatSchedule(course.scheduleSlots)}
                  </p>
                )}

                <div className="mt-auto pt-5">
                  <p className="mb-3 text-sm font-semibold text-azure-800">
                    {course.priceCents > 0
                      ? `${formatPrice(course.priceCents, course.currency)} / Monat`
                      : "Preis auf Anfrage"}
                  </p>
                  <Link
                    href={`/courses/${course.slug}`}
                    className="btn-primary btn-display w-full px-4 py-2.5"
                  >
                    Zum Kurs
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="border border-gold-400/40 bg-white p-6 text-center">
        <p className="mb-3 text-brand-900/80">
          Nicht sicher, welches Level passt? Lass uns das in einem kurzen, kostenlosen Gespräch
          klären.
        </p>
        <BookingButton />
      </div>
    </div>
  );
}
