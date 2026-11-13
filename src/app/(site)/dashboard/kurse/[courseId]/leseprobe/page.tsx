import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { ConfirmButton } from "@/components/confirm-button";
import { ReadingSampleRecorder } from "@/components/reading-sample-recorder";
import { prisma } from "@/lib/prisma";
import { deleteReadingSample } from "@/lib/reading-sample-actions";
import { formatGermanDateTime } from "@/lib/schedule-time";

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  return ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} Min.`;
}

export default async function ReadingSamplePage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ sitzung?: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  const { courseId } = await params;
  const { sitzung } = await searchParams;

  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { id: true, title: true } });
  if (!course) notFound();

  const participants = await prisma.participant.findMany({
    where: { ownerId: session.user.id, enrollments: { some: { courseId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (participants.length === 0) notFound();

  const now = new Date();
  const [upcoming, samples] = await Promise.all([
    prisma.classSession.findMany({
      where: { courseId, startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 4,
      select: { id: true, title: true, startsAt: true, readingRequest: true },
    }),
    prisma.readingSample.findMany({
      where: { courseId, participantId: { in: participants.map((p) => p.id) } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        durationSec: true,
        note: true,
        listenedAt: true,
        teacherComment: true,
        participant: { select: { name: true } },
        session: { select: { title: true, startsAt: true } },
      },
    }),
  ]);

  const requested = upcoming.filter((s) => s.readingRequest);
  const defaultSessionId =
    upcoming.find((s) => s.id === sitzung)?.id ?? requested[0]?.id ?? upcoming[0]?.id;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/dashboard" className="text-sm text-brand-700 underline">
          ← Meine Kurse
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-azure-800">Leseprobe: {course.title}</h1>
        <p className="mt-1 text-sm text-brand-600">
          Lies den erbetenen Abschnitt laut vor und nimm ihn hier auf. Die Lehrkraft hört ihn sich vor
          der Stunde an und kann sich so gezielt vorbereiten.
        </p>
      </div>

      {requested.length > 0 && (
        <ul className="space-y-2">
          {requested.map((s) => (
            <li key={s.id} className="border-l-2 border-gold-400 bg-brand-50 px-3 py-2 text-sm">
              <span className="font-semibold text-azure-800">
                Für die Stunde am {formatGermanDateTime(s.startsAt)} Uhr:
              </span>{" "}
              {s.readingRequest}
            </li>
          ))}
        </ul>
      )}

      <ReadingSampleRecorder
        courseId={course.id}
        participants={participants.map((p) => ({ id: p.id, label: p.name }))}
        sessions={upcoming.map((s) => ({
          id: s.id,
          label: `${formatGermanDateTime(s.startsAt)} Uhr${s.readingRequest ? ` – ${s.readingRequest}` : ""}`,
        }))}
        defaultSessionId={defaultSessionId}
      />

      <section className="space-y-3">
        <h2 className="font-semibold text-azure-800">Bisherige Leseproben</h2>
        {samples.length === 0 && <p className="text-sm text-brand-600">Noch keine Leseproben.</p>}
        <ul className="space-y-3">
          {samples.map((s) => (
            <li key={s.id} className="space-y-2 border border-gold-400/40 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-brand-900">
                  {s.participant.name}
                  <span className="font-normal text-brand-600">
                    {" "}
                    · {formatGermanDateTime(s.createdAt)} Uhr{formatDuration(s.durationSec)}
                    {s.session ? ` · für ${formatGermanDateTime(s.session.startsAt)} Uhr` : ""}
                  </span>
                </p>
                <span className={`text-xs ${s.listenedAt ? "text-green-800" : "text-brand-600"}`}>
                  {s.listenedAt ? "✓ von der Lehrkraft gehört" : "noch nicht gehört"}
                </span>
              </div>
              <audio controls preload="none" src={`/api/leseproben/${s.id}`} className="w-full" />
              {s.note && <p className="text-brand-700">Dein Hinweis: {s.note}</p>}
              {s.teacherComment && (
                <p className="whitespace-pre-line border-l-2 border-gold-400 bg-brand-50 px-3 py-2">
                  <span className="font-semibold text-azure-800">Rückmeldung: </span>
                  {s.teacherComment}
                </p>
              )}
              <form action={deleteReadingSample}>
                <input type="hidden" name="sampleId" value={s.id} />
                <ConfirmButton
                  message="Diese Leseprobe endgültig löschen?"
                  className="text-xs font-medium text-red-800 underline hover:text-red-700"
                >
                  Löschen
                </ConfirmButton>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
