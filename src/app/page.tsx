import Link from "next/link";

import { prisma } from "@/lib/prisma";

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

export default async function HomePage() {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { createdAt: "asc" },
    include: { teacher: { select: { name: true } } },
  });

  const byCategory = courses.reduce<Record<string, typeof courses>>((acc, course) => {
    acc[course.category] = acc[course.category] ?? [];
    acc[course.category].push(course);
    return acc;
  }, {});

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-bold text-brand-700">Unser Kursangebot</h1>
        <p className="mt-2 text-brand-600">
          Online-Unterricht in Koran-Rezitation (Tadschwid), Hifz und islamischer Wissenschaft ­–
          live mit unseren Lehrern.
        </p>
      </section>

      {Object.keys(byCategory).length === 0 && (
        <p className="text-brand-600">
          Aktuell sind noch keine Kurse veröffentlicht. Schau bald wieder vorbei.
        </p>
      )}

      {Object.entries(byCategory).map(([category, categoryCourses]) => (
        <section key={category}>
          <h2 className="mb-4 text-xl font-semibold text-brand-700">{category}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {categoryCourses.map((course) => (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="rounded-lg border border-brand-200 bg-white p-5 shadow-sm transition hover:shadow-md"
              >
                <h3 className="font-semibold text-brand-700">{course.title}</h3>
                <p className="mt-1 text-sm text-brand-600">{course.description}</p>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-brand-600">Lehrer: {course.teacher.name}</span>
                  <span className="font-semibold text-brand-700">
                    {formatPrice(course.priceCents, course.currency)} / Monat
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
