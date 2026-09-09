import Link from "next/link";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createCourse, togglePublish } from "@/lib/teacher-actions";

export default async function TeacherPage() {
  const session = await auth();
  if (!session) return null;

  const courses = await prisma.course.findMany({
    where: { teacherId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { enrollments: true } } },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-700">Meine Kurse (Lehrer-Bereich)</h1>

      <div className="space-y-3">
        {courses.map((course) => (
          <div
            key={course.id}
            className="flex items-center justify-between rounded-lg border border-brand-200 bg-white p-4"
          >
            <div>
              <p className="font-medium text-brand-700">{course.title}</p>
              <p className="text-sm text-brand-600">
                {course._count.enrollments} eingeschriebene Schüler ·{" "}
                {course.isPublished ? "veröffentlicht" : "Entwurf"}
                {!course.stripePriceId && " · kein Stripe-Preis hinterlegt"}
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href={`/teacher/courses/${course.id}`}
                className="text-sm font-medium text-brand-700 underline"
              >
                Sitzungen verwalten
              </Link>
              <form action={togglePublish}>
                <input type="hidden" name="courseId" value={course.id} />
                <button className="text-sm font-medium text-brand-700 underline">
                  {course.isPublished ? "Entwurf setzen" : "Veröffentlichen"}
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-brand-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-brand-700">Neuen Kurs anlegen</h2>
        <form action={createCourse} className="grid gap-3 sm:grid-cols-2">
          <input name="title" placeholder="Titel" required className="rounded-md border border-brand-200 px-3 py-2" />
          <input
            name="slug"
            placeholder="url-slug (z.b. tadschwid-anfaenger)"
            required
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <input
            name="category"
            placeholder="Kategorie (z.B. Koran-Rezitation)"
            required
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <input
            name="priceCents"
            type="number"
            placeholder="Preis pro Monat in Cent (z.B. 2900)"
            required
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <textarea
            name="description"
            placeholder="Beschreibung"
            required
            className="col-span-full rounded-md border border-brand-200 px-3 py-2"
          />
          <button className="col-span-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
            Kurs anlegen
          </button>
        </form>
        <p className="mt-3 text-sm text-brand-600">
          Nach dem Anlegen bitte im Stripe-Dashboard einen monatlichen Preis für den Kurs
          erstellen und die Price-ID in der Datenbank beim Kurs hinterlegen (siehe README),
          bevor du veröffentlichst.
        </p>
      </section>
    </div>
  );
}
