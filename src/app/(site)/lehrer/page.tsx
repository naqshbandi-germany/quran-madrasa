import Link from "next/link";

import { BookingButton } from "@/components/booking-button";
import { prisma } from "@/lib/prisma";

export default async function TeachersPage() {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      image: true,
      bio: true,
      taughtCourses: {
        where: { isPublished: true },
        select: { slug: true, title: true },
        orderBy: { title: "asc" },
      },
    },
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-brand-700">Unsere Lehrer</h1>
        <p className="mt-2 text-brand-600">
          Lernt die Menschen kennen, die euren Unterricht geben.
        </p>
      </section>

      {teachers.length === 0 ? (
        <p className="text-brand-600">Aktuell sind noch keine Lehrer-Profile hinterlegt.</p>
      ) : (
        <div className="space-y-6">
          {teachers.map((teacher) => (
            <div key={teacher.id} className="rounded-lg border border-brand-200 bg-white p-6">
              <div className="flex items-center gap-5">
                {teacher.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={teacher.image}
                    alt={teacher.name}
                    className="h-24 w-24 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-brand-100 text-3xl font-semibold text-brand-700">
                    {teacher.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-semibold text-brand-700">{teacher.name}</h2>
                  <p className="text-sm text-brand-600">Lehrer</p>
                </div>
              </div>

              <p className="mt-4 whitespace-pre-line text-brand-900">
                {teacher.bio || "Noch keine Vita hinterlegt."}
              </p>

              {teacher.taughtCourses.length > 0 && (
                <div className="mt-4 border-t border-brand-100 pt-4">
                  <p className="mb-2 text-sm font-semibold text-brand-700">
                    Unterrichtete Kurse
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {teacher.taughtCourses.map((course) => (
                      <Link
                        key={course.slug}
                        href={`/courses/${course.slug}`}
                        className="rounded-full bg-brand-50 px-3 py-1 text-sm text-brand-700 underline-offset-2 hover:bg-brand-100 hover:underline"
                      >
                        {course.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-5 text-center">
        <p className="mb-3 text-brand-700">Fragen an einen unserer Lehrer? Lernt uns unverbindlich kennen.</p>
        <BookingButton />
      </div>
    </div>
  );
}
