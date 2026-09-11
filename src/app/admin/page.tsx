import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { createTeacherAccount } from "@/lib/admin-actions";
import { togglePublish } from "@/lib/teacher-actions";

export default async function AdminPage() {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { taughtCourses: true } } },
  });

  const courses = await prisma.course.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { name: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-700">Admin-Bereich</h1>

      <section className="rounded-lg border border-brand-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-brand-700">Lehrer</h2>

        {teachers.length === 0 ? (
          <p className="mb-4 text-sm text-brand-600">Noch keine Lehrer angelegt.</p>
        ) : (
          <ul className="mb-4 space-y-1 text-sm text-brand-900">
            {teachers.map((teacher) => (
              <li key={teacher.id}>
                {teacher.name} ({teacher.email}) · {teacher._count.taughtCourses} Kurse
              </li>
            ))}
          </ul>
        )}

        <form action={createTeacherAccount} className="grid gap-3 sm:grid-cols-3">
          <input
            name="name"
            placeholder="Name"
            required
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <input
            name="email"
            type="email"
            placeholder="E-Mail"
            required
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <input
            name="password"
            type="password"
            placeholder="Vorläufiges Passwort (min. 8 Zeichen)"
            required
            minLength={8}
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <button className="col-span-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
            Lehrer-Account anlegen
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-brand-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-brand-700">Alle Kurse</h2>

        {courses.length === 0 ? (
          <p className="text-sm text-brand-600">Noch keine Kurse angelegt.</p>
        ) : (
          <ul className="space-y-2">
            {courses.map((course) => (
              <li
                key={course.id}
                className="flex items-center justify-between rounded-md bg-brand-50 px-3 py-2 text-sm"
              >
                <span>
                  {course.title} · Lehrer: {course.teacher.name} · {course._count.enrollments}{" "}
                  Schüler · {course.isPublished ? "veröffentlicht" : "Entwurf"}
                </span>
                <div className="flex gap-3">
                  <Link href={`/teacher/courses/${course.id}`} className="underline">
                    Sitzungen
                  </Link>
                  <form action={togglePublish}>
                    <input type="hidden" name="courseId" value={course.id} />
                    <button className="underline">
                      {course.isPublished ? "Entwurf setzen" : "Veröffentlichen"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
