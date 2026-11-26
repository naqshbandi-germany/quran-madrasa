import Link from "next/link";

import { auth } from "@/auth";
import { ConfirmButton } from "@/components/confirm-button";
import { CopyButton } from "@/components/copy-button";
import {
  regenerateAccessCode,
  updateCourseSettings,
} from "@/lib/admin-actions";
import { getAppUrl } from "@/lib/app-url";
import { AGE_GROUP_LABELS } from "@/lib/course-labels";
import { formatCoursePeriod } from "@/lib/course-manage";
import { deleteCourse } from "@/lib/course-manage-actions";
import { prisma } from "@/lib/prisma";
import { createCourse, togglePublish } from "@/lib/teacher-actions";
import { CourseStatusBadge } from "@/components/course-status-badge";

export const metadata = { title: "Kurse" };
export const dynamic = "force-dynamic";

// Kursliste: Lehrkraefte sehen ihre eigenen Kurse, Admins alle (mit Preis, Plaetzen und
// Sichtbarkeit). Darunter das Formular fuer einen neuen Kurs.
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ geloescht?: string; loeschen?: string }>;
}) {
  const { geloescht, loeschen } = await searchParams;
  const session = await auth();
  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN";

  const courses = await prisma.course.findMany({
    where: isAdmin ? {} : { teacherId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      teacher: { select: { name: true } },
      _count: { select: { enrollments: true } },
    },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-azure-800">Kurse</h1>
        <p className="mt-1 text-sm text-brand-600">
          {isAdmin ? "Alle Kurse aller Lehrkräfte." : "Deine Kurse."} Ein
          Klick auf den Namen öffnet die Kursverwaltung mit Teilnehmern,
          Sitzungen, Nachrichten und Einstellungen.
        </p>
      </div>

      {geloescht && (
        <p role="status" className="bg-green-50 px-4 py-3 text-sm text-green-900">
          Der Kurs wurde gelöscht.
        </p>
      )}
      {loeschen === "teilnehmer" && (
        <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-900">
          Ein Kurs mit Teilnehmern lässt sich nicht löschen. Entferne zuerst
          alle Teilnehmer oder setze den Kurs auf Entwurf.
        </p>
      )}

      {courses.length === 0 ? (
        <p className="border border-brand-200 bg-white p-4 text-sm text-brand-600">
          Noch keine Kurse angelegt.
        </p>
      ) : (
        <ul className="space-y-3">
          {courses.map((course) => {
            const secretLink =
              isAdmin && course.isHidden && course.accessCode
                ? `${getAppUrl()}/zugang/${course.accessCode}`
                : null;
            return (
              <li
                key={course.id}
                className="border border-gold-400/40 bg-white p-4 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link
                      href={`/teacher/courses/${course.id}`}
                      className="font-display text-2xl font-bold leading-tight text-azure-800 hover:underline"
                    >
                      {course.title}
                    </Link>
                    <p className="mt-0.5 text-brand-600">
                      {isAdmin && <>Lehrer: {course.teacher.name} · </>}
                      <CourseStatusBadge course={course} />{" "}
                      {course._count.enrollments} eingeschriebene Schüler
                      {!course.stripePriceId &&
                        " · kein Stripe-Preis hinterlegt"}
                      {formatCoursePeriod(course.startsOn, course.endsOn) &&
                        ` · Laufzeit ${formatCoursePeriod(course.startsOn, course.endsOn)}`}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <form action={togglePublish}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <button className="font-medium text-brand-700 underline">
                        {course.isPublished
                          ? "Auf Entwurf setzen"
                          : "Zur Anmeldung öffnen"}
                      </button>
                    </form>
                    {course._count.enrollments === 0 ? (
                      <form action={deleteCourse}>
                        <input type="hidden" name="courseId" value={course.id} />
                        <ConfirmButton
                          message={`Den Kurs „${course.title}“ wirklich endgültig löschen? Alle Sitzungen, Probestunden, Einladungen, die Warteliste und Leseproben werden mitgelöscht.`}
                          className="font-medium text-red-800 underline hover:text-red-700"
                        >
                          Löschen
                        </ConfirmButton>
                      </form>
                    ) : (
                      <Link
                        href={`/teacher/courses/${course.id}/einstellungen#loeschen`}
                        className="font-medium text-red-800 underline hover:text-red-700"
                      >
                        Löschen
                      </Link>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-brand-700">
                      Preis, Plätze und Sichtbarkeit
                    </summary>
                    <form
                      action={updateCourseSettings}
                      className="mt-2 grid gap-2 sm:grid-cols-2"
                    >
                      <input type="hidden" name="courseId" value={course.id} />
                      <label className="text-brand-700">
                        Preis pro Monat in € (0 = kostenlos)
                        <input
                          name="price"
                          inputMode="decimal"
                          defaultValue={(course.priceCents / 100)
                            .toFixed(2)
                            .replace(".", ",")}
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5"
                        />
                      </label>
                      <label className="text-brand-700">
                        Stripe-Preis-ID (monatlich, price_...)
                        <input
                          name="stripePriceId"
                          defaultValue={course.stripePriceId ?? ""}
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5 font-mono"
                        />
                      </label>
                      <label className="text-brand-700">
                        Einmalige Anmeldegebühr in € (leer = keine)
                        <input
                          name="signupFee"
                          inputMode="decimal"
                          defaultValue={
                            course.signupFeeCents != null
                              ? (course.signupFeeCents / 100)
                                  .toFixed(2)
                                  .replace(".", ",")
                              : ""
                          }
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5"
                        />
                      </label>
                      <label className="text-brand-700">
                        Stripe-Preis-ID der Gebühr (einmalig, price_...)
                        <input
                          name="signupFeePriceId"
                          defaultValue={course.signupFeePriceId ?? ""}
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5 font-mono"
                        />
                      </label>
                      <label className="text-brand-700">
                        Höchstzahl Teilnehmer (leer = unbegrenzt)
                        <input
                          name="maxParticipants"
                          type="number"
                          min={1}
                          defaultValue={course.maxParticipants ?? ""}
                          className="mt-1 w-full border border-brand-300 px-3 py-1.5"
                        />
                      </label>
                      <label className="flex items-center gap-2 self-end text-brand-700">
                        <input
                          type="checkbox"
                          name="isHidden"
                          defaultChecked={course.isHidden}
                        />
                        Versteckt (nur über geheimen Link erreichbar)
                      </label>
                      <button className="btn-primary px-4 py-1.5 sm:col-span-2 sm:w-fit">
                        Einstellungen speichern
                      </button>
                    </form>
                    {secretLink && (
                      <div className="mt-3 border-t border-brand-200 pt-3">
                        <p className="text-brand-700">
                          Geheimer Link (der Kurs muss außerdem veröffentlicht
                          sein):
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <code className="break-all bg-white px-2 py-1">
                            {secretLink}
                          </code>
                          <CopyButton text={secretLink} />
                          <form action={regenerateAccessCode}>
                            <input
                              type="hidden"
                              name="courseId"
                              value={course.id}
                            />
                            <button className="underline">
                              Neuen Link erzeugen
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <section className="border border-gold-400/40 bg-white p-5">
        <h2 className="mb-4 font-semibold text-azure-800">
          Neuen Kurs anlegen
        </h2>
        <form action={createCourse} className="grid gap-3 sm:grid-cols-2">
          <input
            name="title"
            placeholder="Titel"
            required
            className="border border-brand-300 px-3 py-2"
          />
          <input
            name="slug"
            placeholder="url-slug (z.b. tadschwid-anfaenger)"
            required
            className="border border-brand-300 px-3 py-2"
          />
          <input
            name="category"
            placeholder="Kategorie (z.B. Quran-Rezitation)"
            required
            className="border border-brand-300 px-3 py-2"
          />
          <input
            name="priceCents"
            type="number"
            placeholder="Preis pro Monat in Cent (z.B. 2900)"
            required
            className="border border-brand-300 px-3 py-2"
          />
          <input
            name="level"
            placeholder="Level (optional, z.B. Level 1)"
            className="border border-brand-300 px-3 py-2"
          />
          <input
            name="maxParticipants"
            type="number"
            min={1}
            max={500}
            placeholder="Max. Teilnehmerzahl (leer = unbegrenzt)"
            className="border border-brand-300 px-3 py-2"
          />
          <fieldset className="col-span-full flex flex-wrap gap-4 text-sm text-brand-700">
            <legend className="mb-1 font-medium">Altersgruppe</legend>
            {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
              <label key={value} className="flex items-center gap-1.5">
                <input type="checkbox" name="ageGroups" value={value} />
                {label}
              </label>
            ))}
          </fieldset>
          <textarea
            name="description"
            placeholder="Beschreibung"
            required
            className="col-span-full border border-brand-300 px-3 py-2"
          />
          <button className="btn-primary col-span-full px-4 py-2">
            Kurs anlegen
          </button>
        </form>
        <p className="mt-3 text-sm text-brand-600">
          Nach dem Anlegen bitte im Stripe-Dashboard einen monatlichen Preis für
          den Kurs erstellen und die Price-ID in der Datenbank beim Kurs
          hinterlegen (siehe README), bevor du veröffentlichst.
        </p>
      </section>
    </div>
  );
}
