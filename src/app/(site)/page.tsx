import { OrnamentDivider } from "@/components/ornament";
import { bookingSlide, quranSlide, type HeroSlide } from "@/lib/hero-slides";
import { prisma } from "@/lib/prisma";
import type { CatalogCourse } from "@/lib/course-labels";
import { CourseCatalog } from "./course-catalog";
import { HeroCarousel } from "./hero-carousel";

// Die Terminanzeige auf den Kurskarten haengt von der deutschen Sommer-/Winterzeit
// ab, daher stuendlich neu erzeugen.
export const revalidate = 3600;

export default async function HomePage() {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    include: {
      teacher: { select: { name: true } },
      scheduleSlots: { orderBy: [{ weekday: "asc" }, { startTime: "asc" }] },
    },
  });

  const catalogCourses: CatalogCourse[] = courses.map((course) => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    description: course.description,
    category: course.category,
    level: course.level,
    ageGroups: course.ageGroups,
    priceCents: course.priceCents,
    currency: course.currency,
    teacherName: course.teacher.name,
    scheduleSlots: course.scheduleSlots.map((slot) => ({
      weekday: slot.weekday,
      startTime: slot.startTime,
      endTime: slot.endTime,
      note: slot.note,
    })),
  }));

  // Der Quran-Slide ersetzt den Hifz-Slide; fehlt Hifz unter den ersten Kursen, kommt er
  // trotzdem direkt nach dem Beratungs-Slide.
  const quran = quranSlide();
  const courseSlides: HeroSlide[] = catalogCourses.slice(0, 3).map((c) =>
    c.category === "Hifz"
      ? quran
      : { kind: "course", slug: c.slug, title: c.title, description: c.description, category: c.category },
  );
  const slides: HeroSlide[] = [
    bookingSlide(),
    ...(courseSlides.includes(quran) ? courseSlides : [quran, ...courseSlides]),
  ];

  return (
    <div className="space-y-8">
      {/* Volle Breite: aus dem zentrierten Seiteninhalt ausbrechen, direkt unter die Kopfzeile */}
      <div className="relative left-1/2 -mt-8 w-screen -translate-x-1/2">
        <HeroCarousel slides={slides} />
      </div>

      <section>
        <h2 className="text-3xl font-bold text-brand-700">Unser Kursangebot</h2>
        <OrnamentDivider className="mt-3" />
        <p className="mt-2 text-brand-600">
          Online-Unterricht in Quran-Rezitation (Tadschwid), Hifz und islamischer Wissenschaft –
          live mit unseren Lehrern. Filtere nach Thema, Altersgruppe, Lehrer, Level oder
          Wochentag.
        </p>
      </section>

      {catalogCourses.length === 0 ? (
        <p className="text-brand-600">
          Aktuell sind noch keine Kurse veröffentlicht. Schau bald wieder vorbei.
        </p>
      ) : (
        <CourseCatalog courses={catalogCourses} />
      )}
    </div>
  );
}
