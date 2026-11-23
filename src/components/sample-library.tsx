import Link from "next/link";

import { fullName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { READING_SAMPLE_RETENTION_DAYS } from "@/lib/reading-samples";
import { formatZonedDateTime } from "@/lib/schedule-time";
import { toggleTrialSampleListened } from "@/lib/trial-actions";
import { resolveViewTimeZone } from "@/lib/view-time-zone";

const PAGE_SIZE = 100;

type Entry = {
  id: string;
  kind: "student" | "trial" | "invitation";
  name: string;
  course: { id: string; title: string; teacher: { name: string; muslimName: string | null } };
  // Profil, Termin oder Hoerproben des Kurses
  href: string;
  hrefLabel: string;
  createdAt: Date;
  durationSec: number | null;
  note: string | null;
  listenedAt: Date | null;
};

const KIND_LABELS: Record<Entry["kind"], string | null> = {
  student: null,
  trial: "Probestunde",
  invitation: "Einladung, noch nicht angemeldet",
};

function duration(seconds: number | null) {
  return seconds ? ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} Min.` : "";
}

// Alle Hoerproben auf einen Blick (Mediathek): von Schuelern, Probestunden-Gaesten und
// Eingeladenen. Lehrkraefte sehen ihre Kurse, Admins alle.
export async function SampleLibrary({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const ownCourse = isAdmin ? {} : { teacherId: userId };
  const courseSelect = {
    select: { id: true, title: true, teacher: { select: { name: true, muslimName: true } } },
  } as const;
  const fields = { id: true, createdAt: true, durationSec: true, note: true, listenedAt: true } as const;

  const [students, guests, { timeZone }] = await Promise.all([
    prisma.readingSample.findMany({
      where: { course: ownCourse },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        ...fields,
        participantId: true,
        participant: { select: { name: true, muslimName: true, enrollments: { select: { course: { select: { teacherId: true } } } } } },
        course: courseSelect,
      },
    }),
    prisma.trialSample.findMany({
      where: { OR: [{ trialGuest: { trialLesson: { course: ownCourse } } }, { invitation: { course: ownCourse } }] },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      select: {
        ...fields,
        trialGuest: { select: { name: true, trialLesson: { select: { startsAt: true, course: courseSelect } } } },
        invitation: { select: { name: true, course: courseSelect } },
      },
    }),
    resolveViewTimeZone(userId),
  ]);

  const now = new Date();
  const entries: Entry[] = [
    ...students.map(({ participant, participantId, course, ...s }) => {
      // Das Profil gibt es nur fuer (noch) eingeschriebene Schueler.
      const profile = participant.enrollments.some((e) => isAdmin || e.course.teacherId === userId);
      return {
        ...s,
        kind: "student" as const,
        name: fullName(participant),
        course,
        href: profile ? `/teacher/schueler/${participantId}#hoerproben` : `/teacher/courses/${course.id}/leseproben`,
        hrefLabel: "Rückmeldung geben",
      };
    }),
    ...guests.flatMap(({ trialGuest, invitation, ...s }): Entry[] => {
      if (trialGuest) {
        const past = trialGuest.trialLesson.startsAt < now;
        return [
          {
            ...s,
            kind: "trial",
            name: trialGuest.name,
            course: trialGuest.trialLesson.course,
            href: `/teacher/termine${past ? "?zeit=vergangen" : ""}#probestunden`,
            hrefLabel: "Zum Termin",
          },
        ];
      }
      if (!invitation) return [];
      return [
        {
          ...s,
          kind: "invitation",
          name: invitation.name || "Eingeladene Person",
          course: invitation.course,
          href: `/teacher/courses/${invitation.course.id}/leseproben`,
          hrefLabel: "Zur Einladung",
        },
      ];
    }),
  ].sort(
    (a, b) =>
      Number(Boolean(a.listenedAt)) - Number(Boolean(b.listenedAt)) || b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const unheard = entries.filter((e) => !e.listenedAt).length;

  return (
    <section aria-labelledby="hoerproben" className="space-y-3">
      <div>
        <h2 id="hoerproben" className="font-semibold text-azure-800">
          Hörproben ({entries.length})
        </h2>
        <p className="mt-1 text-sm text-brand-600">
          {unheard > 0 ? `${unheard} noch nicht gehört. ` : ""}
          Aufnahmen {isAdmin ? "aus allen Kursen" : "aus deinen Kursen"}, auch von Probestunden-Gästen und Eingeladenen.
          Sie werden nach {Math.round(READING_SAMPLE_RETENTION_DAYS / 30)} Monaten automatisch gelöscht.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="border border-brand-200 bg-white p-4 text-sm text-brand-600">Noch keine Hörproben.</p>
      ) : (
        <ul className="divide-y divide-brand-200 border border-brand-200 bg-white">
          {entries.map((e) => (
            <li key={`${e.kind}-${e.id}`} className="space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium text-brand-900">
                  {e.name}
                  <span className="font-normal text-brand-600">
                    {" "}
                    · {formatZonedDateTime(e.createdAt, timeZone)} Uhr{duration(e.durationSec)}
                  </span>
                </p>
                {!e.listenedAt && (
                  <span className="bg-azure-800 px-2 py-0.5 text-xs font-semibold text-white">neu</span>
                )}
              </div>
              <p className="text-brand-700">
                <Link href={`/teacher/courses/${e.course.id}`} className="underline">
                  {e.course.title}
                </Link>
                {isAdmin && ` · Lehrkraft: ${fullName(e.course.teacher)}`}
                {KIND_LABELS[e.kind] && ` · ${KIND_LABELS[e.kind]}`}
              </p>
              <audio
                controls
                preload="none"
                src={e.kind === "student" ? `/api/leseproben/${e.id}` : `/api/probestunde/hoerprobe/${e.id}`}
                aria-label={`Hörprobe von ${e.name}`}
                className="w-full max-w-xl"
              />
              {e.note && <p className="text-brand-700">Hinweis: {e.note}</p>}
              <div className="flex flex-wrap items-center gap-4">
                <Link href={e.href} className="font-medium text-brand-700 underline">
                  {e.hrefLabel}
                </Link>
                {e.kind !== "student" && (
                  <form action={toggleTrialSampleListened}>
                    <input type="hidden" name="sampleId" value={e.id} />
                    <button className={e.listenedAt ? "text-green-800" : "font-medium text-azure-800 underline"}>
                      {e.listenedAt ? "✓ gehört" : "Als gehört markieren"}
                    </button>
                  </form>
                )}
                {e.kind === "student" && e.listenedAt && <span className="text-green-800">✓ gehört</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
