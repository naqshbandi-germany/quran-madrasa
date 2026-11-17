import Link from "next/link";

import { auth } from "@/auth";
import { fullName } from "@/lib/names";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Schüler" };
export const dynamic = "force-dynamic";

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" });

// Alle eingeschriebenen Teilnehmer: bei Lehrkraeften aus den eigenen Kursen, bei Admins aus
// allen. Oben das Formular zum Einladen (auch mehrerer Schueler auf einmal).
export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ kurs?: string }> }) {
  const session = await auth();
  if (!session) return null;
  const isAdmin = session.user.role === "ADMIN";
  const { kurs } = await searchParams;

  const courses = await prisma.course.findMany({
    where: isAdmin ? {} : { teacherId: session.user.id },
    orderBy: { title: "asc" },
    select: { id: true, title: true, isPublished: true, isHidden: true },
  });
  const courseFilter = courses.find((c) => c.id === kurs)?.id;

  const enrollments = await prisma.enrollment.findMany({
    where: {
      courseId: courseFilter ?? { in: courses.map((c) => c.id) },
    },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { id: true, title: true } },
      participant: { select: { id: true, name: true, muslimName: true, relation: true, birthYear: true, email: true } },
      user: { select: { name: true, muslimName: true, email: true } },
    },
  });

  // Eine Zeile pro Teilnehmer, auch wenn er in mehreren Kursen ist.
  const rows = new Map<
    string,
    {
      participant: (typeof enrollments)[number]["participant"];
      owner: (typeof enrollments)[number]["user"];
      courses: { id: string; title: string; since: Date }[];
    }
  >();
  for (const e of enrollments) {
    const row = rows.get(e.participant.id) ?? { participant: e.participant, owner: e.user, courses: [] };
    row.courses.push({ id: e.course.id, title: e.course.title, since: e.createdAt });
    rows.set(e.participant.id, row);
  }
  const inviteHref = courseFilter ? `/teacher/schueler/einladen?kurs=${courseFilter}` : "/teacher/schueler/einladen";
  const list = [...rows.values()].sort((a, b) => fullName(a.participant).localeCompare(fullName(b.participant), "de"));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h1 className="text-2xl font-bold text-azure-800">Schüler</h1>
        <p className="mt-1 text-sm text-brand-600">
          {isAdmin ? "Alle eingeschriebenen Teilnehmer aller Kurse." : "Alle Teilnehmer deiner Kurse."} Anwesenheit,
          Lernstand und „Aus Kurs entfernen“ findest du auf der Seite des jeweiligen Kurses.
        </p>
        </div>
        <Link href={inviteHref} className="btn-primary px-4 py-2 text-sm">
          Schüler einladen
        </Link>
      </div>


      <section aria-labelledby="liste" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="liste" className="font-semibold text-azure-800">
            Eingeschriebene Schüler ({list.length})
          </h2>
          {courses.length > 1 && (
            <nav aria-label="Nach Kurs filtern" className="flex flex-wrap gap-2 text-sm">
              <Link
                href="/teacher/schueler"
                aria-current={!courseFilter ? "page" : undefined}
                className={`rounded-full border px-3 py-1 ${!courseFilter ? "border-azure-700 bg-azure-700 text-white" : "border-brand-300 bg-white text-brand-800"}`}
              >
                Alle Kurse
              </Link>
              {courses.map((c) => (
                <Link
                  key={c.id}
                  href={`/teacher/schueler?kurs=${c.id}`}
                  aria-current={courseFilter === c.id ? "page" : undefined}
                  className={`rounded-full border px-3 py-1 ${courseFilter === c.id ? "border-azure-700 bg-azure-700 text-white" : "border-brand-300 bg-white text-brand-800"}`}
                >
                  {c.title}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {list.length === 0 ? (
          <p className="border border-brand-200 bg-white p-4 text-sm text-brand-600">Noch keine eingeschriebenen Schüler.</p>
        ) : (
          <div className="overflow-x-auto border border-brand-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand-200 bg-brand-50 text-brand-700">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Name</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Kurs</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Kontakt</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Seit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-200">
                {list.map(({ participant, owner, courses: taken }) => (
                  <tr key={participant.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/teacher/schueler/${participant.id}`} className="font-medium text-brand-900 underline hover:text-azure-800">
                        {fullName(participant)}
                      </Link>
                      {participant.relation === "CHILD" && (
                        <span className="block text-xs text-brand-600">
                          Kind{participant.birthYear ? `, Jahrgang ${participant.birthYear}` : ""}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {taken.map((c) => (
                        <Link key={c.id} href={`/teacher/courses/${c.id}#teilnehmer`} className="block text-brand-700 underline">
                          {c.title}
                        </Link>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-brand-800">
                      {participant.email ? (
                        <a href={`mailto:${participant.email}`} className="underline">{participant.email}</a>
                      ) : (
                        <>
                          über {owner.name}:{" "}
                          <a href={`mailto:${owner.email}`} className="underline">{owner.email}</a>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-brand-600">
                      {taken.map((c) => (
                        <span key={c.id} className="block">{dateFormat.format(c.since)}</span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Link href={inviteHref} className="inline-block text-sm font-medium text-brand-700 underline">
          Weitere Schüler einladen
        </Link>
      </section>
    </div>
  );
}
