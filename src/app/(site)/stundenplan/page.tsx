import { BookingButton } from "@/components/booking-button";
import { OrnamentDivider } from "@/components/ornament";
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
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold text-brand-900">Stundenplan</h1>
          <OrnamentDivider className="mt-3" />
          <p className="mt-3 max-w-xl text-brand-900/75">
            Alle wöchentlichen Unterrichtszeiten auf einen Blick, in deutscher Zeit. Klick auf einen
            Termin für Details zum Kurs.
          </p>
        </div>
        {timetable.blocks.length > 0 && (
          <a
            href="/stundenplan/pdf"
            download
            className="rounded-md border border-azure-800 px-4 py-2 text-sm font-medium text-azure-800 transition hover:bg-azure-800 hover:text-white"
          >
            Als PDF herunterladen
          </a>
        )}
      </section>

      {timetable.blocks.length === 0 ? (
        <p className="text-brand-900/75">Aktuell sind keine Unterrichtszeiten hinterlegt.</p>
      ) : (
        <TimetableView timetable={timetable} />
      )}

      <div className="rounded-md border border-brand-200 bg-white p-6 text-center">
        <p className="mb-3 text-brand-900/80">
          Nicht sicher, welcher Kurs passt? Lass uns das in einem kurzen, kostenlosen Gespräch
          klären.
        </p>
        <BookingButton />
      </div>
    </div>
  );
}
