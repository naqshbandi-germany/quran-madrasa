import { prisma } from "@/lib/prisma";
import type { CatalogCourse } from "@/lib/course-labels";
import { CourseCatalog } from "./course-catalog";

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

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-brand-700">Unser Kursangebot</h1>
        <p className="mt-2 text-brand-600">
          Online-Unterricht in Koran-Rezitation (Tadschwid), Hifz und islamischer Wissenschaft –
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
