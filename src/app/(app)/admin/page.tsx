import Link from "next/link";

import { prisma } from "@/lib/prisma";
import {
  createTeacherAccount,
  updateLegalTexts,
  updateSiteContent,
  updateTeacherProfile,
} from "@/lib/admin-actions";
import { DEFAULT_IMPRESSUM, DEFAULT_PRIVACY_POLICY } from "@/lib/legal-defaults";
import { togglePublish } from "@/lib/teacher-actions";

export default async function AdminPage() {
  const teachers = await prisma.user.findMany({
    where: { role: "TEACHER" },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { taughtCourses: true } } },
  });

  const siteContent = await prisma.siteContent.findUnique({ where: { id: "main" } });

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
          <div className="mb-4 space-y-2">
            {teachers.map((teacher) => (
              <details key={teacher.id} className="rounded-md border border-brand-200 px-3 py-2">
                <summary className="cursor-pointer text-sm text-brand-900">
                  {teacher.name} ({teacher.email}) · {teacher._count.taughtCourses} Kurse
                </summary>
                <form
                  action={updateTeacherProfile}
                  className="mt-3 grid gap-2 border-t border-brand-100 pt-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="teacherId" value={teacher.id} />
                  <input
                    name="image"
                    placeholder="Foto-URL (https://...)"
                    defaultValue={teacher.image ?? ""}
                    className="rounded-md border border-brand-200 px-3 py-2 text-sm"
                  />
                  <textarea
                    name="bio"
                    placeholder="Kurze Vita"
                    defaultValue={teacher.bio ?? ""}
                    rows={2}
                    className="rounded-md border border-brand-200 px-3 py-2 text-sm sm:col-span-2"
                  />
                  <button className="rounded-md bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 sm:col-span-2 sm:w-fit">
                    Profil speichern
                  </button>
                </form>
              </details>
            ))}
          </div>
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
        <h2 className="mb-4 font-semibold text-brand-700">Website-Inhalte</h2>
        <form action={updateSiteContent} className="space-y-3">
          <label className="block text-sm text-brand-700">
            Statement of Purpose (Seite &quot;Ziel &amp; Zweck&quot;)
            <textarea
              name="missionStatement"
              defaultValue={siteContent?.missionStatement ?? ""}
              rows={6}
              placeholder="Unser Ziel ist es, hochwertigen Koran-Unterricht kostengünstig und für jeden zugänglich zu machen..."
              className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            />
          </label>
          <button className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
            Text speichern
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-brand-200 bg-white p-5">
        <h2 className="mb-1 font-semibold text-brand-700">Rechtstexte</h2>
        <p className="mb-4 text-sm text-brand-600">
          Impressum und Datenschutzerklärung der Website. Absätze durch Leerzeilen trennen,
          Zwischenüberschriften mit &quot;## &quot; am Zeilenanfang. Angezeigt wird der hier
          gespeicherte Text; ist nichts gespeichert, erscheint der Standard-Entwurf. Angaben in
          [eckigen Klammern] müssen ergänzt werden, und die Texte sollten juristisch geprüft
          werden.
        </p>
        <form action={updateLegalTexts} className="space-y-4">
          <label className="block text-sm text-brand-700">
            Impressum
            <textarea
              name="impressum"
              defaultValue={siteContent?.impressum || DEFAULT_IMPRESSUM}
              rows={14}
              className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm text-brand-700">
            Datenschutzerklärung
            <textarea
              name="privacyPolicy"
              defaultValue={siteContent?.privacyPolicy || DEFAULT_PRIVACY_POLICY}
              rows={24}
              className="mt-1 w-full rounded-md border border-brand-200 px-3 py-2 font-mono text-sm"
            />
          </label>
          <button className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
            Rechtstexte speichern
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
