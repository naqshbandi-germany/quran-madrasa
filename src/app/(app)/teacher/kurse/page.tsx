import Link from "next/link";

import { auth } from "@/auth";
import { CopyButton } from "@/components/copy-button";
import {
  regenerateAccessCode,
  updateCourseSettings,
} from "@/lib/admin-actions";
import { getAppUrl } from "@/lib/app-url";
import { AGE_GROUP_LABELS } from "@/lib/course-labels";
import { prisma } from "@/lib/prisma";
import { createCourse, togglePublish } from "@/lib/teacher-actions";

export const metadata = { title: "Kurse" };
export const dynamic = "force-dynamic";

// Kursliste: Lehrkraefte sehen ihre eigenen Kurse, Admins alle (mit Preis, Plaetzen und
// Sichtbarkeit). Darunter das Formular fuer einen neuen Kurs.
export default async function CoursesPage() {
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
          {isAdmin ? "Alle Kurse aller Lehrkräfte." : "Deine Kurse."} Über
          „Verwalten“ kommst du zu Sitzungen, Teilnehmern, Einladungen und
          Warteliste eines Kurses.
        </p>
      </div>

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
                    <p className="text-base font-medium text-brand-700">
                      {course.title}
                    </p>
                    <p className="text-brand-600">
                      {isAdmin && <>Lehrer: {course.teacher.name} · </>}
                      {course._count.enrollments} eingeschriebene Schüler ·{" "}
                      {course.isPublished ? "veröffentlicht" : "Entwurf"}
                      {course.isHidden && " · versteckt"}
                      {!course.stripePriceId &&
                        " · kein Stripe-Preis hinterlegt"}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <Link
                      href={`/teacher/courses/${course.id}`}
                      className="font-medium text-brand-700 underline"
                    >
                      Verwalten
                    </Link>
                    <form action={togglePublish}>
                      <input type="hidden" name="courseId" value={course.id} />
                      <button className="font-medium text-brand-700 underline">
                        {course.isPublished
                          ? "Entwurf setzen"
                          : "Veröffentlichen"}
                      </button>
                    </form>
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
