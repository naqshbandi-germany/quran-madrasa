import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EMPTY_SERIES, SeriesForm } from "@/components/series-form";
import { SingleSessionForm } from "@/components/session-forms";
import { prisma } from "@/lib/prisma";
import { timeZoneLabel } from "@/lib/time-zones";
import { resolveViewTimeZone } from "@/lib/view-time-zone";

export const metadata = { title: "Termin anlegen" };
export const dynamic = "force-dynamic";

const BOX = "space-y-3 border border-gold-400/40 bg-white p-5";

// Termine > "Termin anlegen": Terminserie oder einzelne Stunde fuer einen waehlbaren Kurs.
// Nach dem Speichern geht es in den Reiter Sitzungen des Kurses, wo sich alles einsehen und
// aendern laesst.
export default async function NewAppointmentPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");
  const isAdmin = session.user.role === "ADMIN";
  const { timeZone } = await resolveViewTimeZone(session.user.id);

  const courses = await prisma.course.findMany({
    where: isAdmin ? {} : { teacherId: session.user.id },
    orderBy: { title: "asc" },
    select: { id: true, title: true, startedAt: true, endsOn: true },
  });
  const seriesCourses = courses.map((c) => ({
    id: c.id,
    title: c.title,
    started: Boolean(c.startedAt),
    endsOn: c.endsOn ? c.endsOn.toISOString().slice(0, 10) : null,
  }));
  const zoneHint = timeZone === "Europe/Berlin" ? "" : ` Zeiten in ${timeZoneLabel(timeZone)}.`;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href="/teacher/termine" className="text-sm text-brand-700 underline">
          ← Termine
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-azure-800">Termin anlegen</h1>
        <p className="mt-1 text-sm text-brand-600">
          Danach landest du im Reiter Sitzungen des Kurses und kannst dort alles einsehen und ändern.{zoneHint}
        </p>
      </div>

      {courses.length === 0 ? (
        <p className="border border-brand-200 bg-white p-4 text-sm text-brand-600">Es gibt noch keinen Kurs.</p>
      ) : (
        <>
          <section className={BOX}>
            <h2 className="font-semibold text-azure-800">Terminserie (feste Kurszeiten)</h2>
            <p className="text-sm text-brand-600">
              Z. B. Montag und Mittwoch 18:00–19:00. Steht sofort im Stundenplan; die Stunden mit Zoom-Link entstehen,
              sobald der Kurs läuft. Für einen laufenden Kurs sind erster und letzter Tag nötig.
            </p>
            <SeriesForm courses={seriesCourses} defaults={EMPTY_SERIES} submitLabel="Serie anlegen" />
          </section>

          <section className={BOX}>
            <h2 className="font-semibold text-azure-800">Einzelne Stunde</h2>
            <p className="text-sm text-brand-600">
              Für Zusatz- oder Ersatztermine außerhalb einer Serie, mit automatisch erzeugtem Zoom-Link.
            </p>
            <SingleSessionForm courses={courses} />
          </section>
        </>
      )}
    </div>
  );
}
