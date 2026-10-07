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
        <h1 className="text-4xl font-semibold text-brand-900 sm:text-5xl">
          Quran-Unterricht für alle Level
        </h1>
        <OrnamentDivider className="mx-auto mt-4" />
      </section>

      {/* Zitat ohne Hintergrund; die Eck-Ornamente schliessen buendig mit dem Seiteninhalt ab */}
      <figure className="relative px-6 py-24 text-center sm:px-36 sm:py-32">
        <CornerOrnament className="absolute left-0 top-0" />
        <CornerOrnament className="absolute right-0 top-0 -scale-x-100" />
        <CornerOrnament className="absolute bottom-0 right-0 -scale-100" />
        <CornerOrnament className="absolute bottom-0 left-0 -scale-y-100" />

        <blockquote>
          <p lang="en" className="mx-auto max-w-3xl font-quote text-2xl italic leading-relaxed text-brand-900 sm:text-3xl sm:leading-relaxed">
            „{QUOTE.text}“
          </p>
        </blockquote>
        <figcaption className="mt-10 text-xs uppercase tracking-[0.14em] text-azure-700 sm:text-sm sm:tracking-[0.2em]">
          {QUOTE.author}
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
