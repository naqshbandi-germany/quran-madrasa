import { RemoveForm } from "../remove-form";
import { CopyButton } from "@/components/copy-button";
import { CourseDetailsForm } from "@/components/course-details-form";
import { regenerateAccessCode, updateCourseSettings } from "@/lib/admin-actions";
import { getAppUrl } from "@/lib/app-url";
import { deleteCourse } from "@/lib/course-manage-actions";
import { requireManagedCourse } from "@/lib/course-manage";
import { prisma } from "@/lib/prisma";
import { togglePublish } from "@/lib/teacher-actions";

const INPUT = "mt-1 w-full border border-brand-300 bg-white px-3 py-2";
const SECTION = "space-y-4 border border-gold-400/40 bg-white p-6";

function dateInput(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function euro(cents: number | null) {
  return cents != null ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

// Reiter "Einstellungen": Kursdaten und Laufzeit (Lehrkraft und Admin), Preis, Stripe und
// Sichtbarkeit (nur Admin), Veroeffentlichen und Loeschen.
export default async function CourseSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { course, isAdmin } = await requireManagedCourse(id);
  const enrolled = await prisma.enrollment.count({ where: { courseId: id } });
  const secretLink = isAdmin && course.isHidden && course.accessCode ? `${getAppUrl()}/zugang/${course.accessCode}` : null;

  return (
    <div className="space-y-8">
      <section aria-labelledby="kursdaten" className={SECTION}>
        <h2 id="kursdaten" className="text-lg font-semibold text-azure-800">
          Kursdaten
        </h2>
        <CourseDetailsForm
          course={{
            id: course.id,
            title: course.title,
            description: course.description,
            category: course.category,
            level: course.level ?? "",
            ageGroups: course.ageGroups,
            maxParticipants: course.maxParticipants != null ? String(course.maxParticipants) : "",
            startsOn: dateInput(course.startsOn),
            endsOn: dateInput(course.endsOn),
          }}
        />
      </section>

      {isAdmin && (
        <section aria-labelledby="preis" className={SECTION}>
          <div>
            <h2 id="preis" className="text-lg font-semibold text-azure-800">
              Preis, Stripe und Sichtbarkeit
            </h2>
            <p className="text-sm text-brand-600">Nur für Admins sichtbar.</p>
          </div>
          <form action={updateCourseSettings} className="grid gap-4 text-sm sm:grid-cols-2">
            <input type="hidden" name="courseId" value={course.id} />
            <label className="font-medium text-brand-700">
              Preis pro Monat in € (0 = kostenlos)
              <input name="price" inputMode="decimal" defaultValue={euro(course.priceCents)} className={INPUT} />
            </label>
            <label className="font-medium text-brand-700">
              Stripe-Preis-ID (monatlich, price_...)
              <input name="stripePriceId" defaultValue={course.stripePriceId ?? ""} className={`${INPUT} font-mono`} />
            </label>
            <label className="font-medium text-brand-700">
              Einmalige Anmeldegebühr in € (leer = keine)
              <input name="signupFee" inputMode="decimal" defaultValue={euro(course.signupFeeCents)} className={INPUT} />
            </label>
            <label className="font-medium text-brand-700">
              Stripe-Preis-ID der Gebühr (einmalig, price_...)
              <input
                name="signupFeePriceId"
                defaultValue={course.signupFeePriceId ?? ""}
                className={`${INPUT} font-mono`}
              />
            </label>
            <label className="flex items-center gap-2 font-medium text-brand-700 sm:col-span-2">
              <input type="checkbox" name="isHidden" defaultChecked={course.isHidden} />
              Versteckt (nur über geheimen Link erreichbar)
            </label>
            <button className="btn-primary px-5 py-2.5 sm:col-span-2 sm:w-fit">Preis und Sichtbarkeit speichern</button>
          </form>
          {secretLink && (
            <div className="border-t border-brand-200 pt-4 text-sm">
              <p className="text-brand-700">Geheimer Link (der Kurs muss außerdem veröffentlicht sein):</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <code className="break-all bg-brand-50 px-2 py-1">{secretLink}</code>
                <CopyButton text={secretLink} />
                <form action={regenerateAccessCode}>
                  <input type="hidden" name="courseId" value={course.id} />
                  <button className="underline">Neuen Link erzeugen</button>
                </form>
              </div>
            </div>
          )}
        </section>
      )}

      <section aria-labelledby="status" className={SECTION}>
        <h2 id="status" className="text-lg font-semibold text-azure-800">
          Veröffentlichen
        </h2>
        <p className="text-sm text-brand-700">
          {course.isPublished
            ? "Der Kurs ist veröffentlicht und kann gebucht werden."
            : "Der Kurs ist ein Entwurf und erscheint nicht auf der Website."}
        </p>
        <form action={togglePublish}>
          <input type="hidden" name="courseId" value={course.id} />
          <button className="border border-azure-800 px-4 py-2 text-sm font-medium text-azure-800 transition hover:bg-azure-800 hover:text-white">
            {course.isPublished ? "Auf Entwurf setzen" : "Veröffentlichen"}
          </button>
        </form>
      </section>

      <section aria-labelledby="loeschen" className="space-y-3 border border-red-300 bg-white p-6">
        <h2 id="loeschen" className="text-lg font-semibold text-red-800">
          Kurs löschen
        </h2>
        {enrolled > 0 ? (
          <p className="text-sm text-brand-700">
            Ein Kurs mit Teilnehmern lässt sich nicht löschen (Abos und Zahlungen hängen daran). Entferne
            zuerst alle {enrolled} Teilnehmer oder setze den Kurs auf Entwurf.
          </p>
        ) : (
          <>
            <p className="text-sm text-brand-700">
              Löscht den Kurs mit allen Sitzungen, Stundenplan-Einträgen, Probestunden, Einladungen,
              Warteliste und Leseproben. Das lässt sich nicht rückgängig machen.
            </p>
            <RemoveForm
              action={deleteCourse}
              fields={{ courseId: course.id }}
              label="Kurs endgültig löschen"
              message={`Den Kurs „${course.title}“ wirklich endgültig löschen? Alle Sitzungen, Probestunden, Einladungen, die Warteliste und Leseproben werden mitgelöscht.`}
            />
          </>
        )}
      </section>
    </div>
  );
}
