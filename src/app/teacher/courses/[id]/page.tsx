import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClassSession } from "@/lib/teacher-actions";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function ManageCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await prisma.course.findUnique({
    where: { id },
    include: { sessions: { orderBy: { startsAt: "asc" } } },
  });
  if (!course) notFound();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-brand-700">{course.title} – Sitzungen</h1>

      <ul className="space-y-2">
        {course.sessions.map((classSession) => (
          <li
            key={classSession.id}
            className="rounded-md border border-brand-200 bg-white px-4 py-3 text-sm"
          >
            <span className="font-medium">{classSession.title}</span> ·{" "}
            {formatDateTime(classSession.startsAt)} ·{" "}
            {classSession.joinUrl ? (
              <a href={classSession.joinUrl} className="underline">
                Zoom-Link
              </a>
            ) : (
              "kein Link hinterlegt"
            )}
          </li>
        ))}
      </ul>

      <section className="rounded-lg border border-brand-200 bg-white p-5">
        <h2 className="mb-4 font-semibold text-brand-700">Neue Sitzung anlegen</h2>
        <form action={createClassSession} className="grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="courseId" value={course.id} />
          <input
            name="title"
            placeholder="Titel (z.B. Sure Al-Baqara, Vers 1-10)"
            required
            className="col-span-full rounded-md border border-brand-200 px-3 py-2"
          />
          <input
            name="startsAt"
            type="datetime-local"
            required
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <input
            name="joinUrl"
            type="url"
            placeholder="Zoom-Link (https://zoom.us/j/...)"
            className="rounded-md border border-brand-200 px-3 py-2"
          />
          <button className="col-span-full rounded-md bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700">
            Sitzung anlegen
          </button>
        </form>
      </section>
    </div>
  );
}
