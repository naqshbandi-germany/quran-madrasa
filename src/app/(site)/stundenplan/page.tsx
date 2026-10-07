import { BookingButton } from "@/components/booking-button";
import { prisma } from "@/lib/prisma";
import { buildTimetable } from "@/lib/timetable";
import { TimetableView } from "./timetable-view";

// Die Anzeige haengt von der deutschen Sommer-/Winterzeit ab, daher stuendlich neu
// erzeugen, damit sie nach der Zeitumstellung nicht veraltet bleibt.
export const revalidate = 3600;

export default async function TimetablePage() {
  const courses = await prisma.course.findMany({
    where: { isPublished: true },
    orderBy: { title: "asc" },
    include: { scheduleSlots: true },
  });

  const timetable = buildTimetable(courses);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-xl text-brand-600">
          Alle wöchentlichen Unterrichtszeiten auf einen Blick. Klick auf einen Termin für Details
          zum Kurs.
        </p>
        {timetable.blocks.length > 0 && (
          <a
            href="/stundenplan/pdf"
            download
            className="rounded-md border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 transition hover:bg-brand-50"
          >
            Als PDF herunterladen
          </a>
        )}
      </section>

      {timetable.blocks.length === 0 ? (
        <div>
          <h1 className="text-3xl font-bold text-brand-700">Stundenplan</h1>
          <p className="mt-2 text-brand-600">Aktuell sind keine Unterrichtszeiten hinterlegt.</p>
        </div>
      ) : (
        <TimetableView timetable={timetable} />
      )}

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-5 text-center">
        <p className="mb-3 text-brand-700">
          Nicht sicher, welcher Kurs passt? Lass uns das in einem kurzen, kostenlosen Gespräch
          klären.
        </p>
        <BookingButton />
      </div>
    </div>
  );
}
