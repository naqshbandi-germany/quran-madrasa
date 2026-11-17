import Link from "next/link";

import { RemoveForm } from "./remove-form";
import { ParticipantsList, type ParticipantRow } from "@/components/participants-list";
import { WaitlistContactButton } from "@/components/waitlist-contact-button";
import { capacityOf } from "@/lib/course-capacity";
import { nameWithMuslimName, requireManagedCourse } from "@/lib/course-manage";
import { prisma } from "@/lib/prisma";
import { formatAttendance, getProgressSummaries, type ProgressSummary } from "@/lib/progress";
import { removeWaitlistEntry } from "@/lib/waitlist-actions";

function progressLine(s: ProgressSummary | undefined) {
  if (!s || (s.recorded === 0 && !s.position && s.tajweedRating == null)) return undefined;
  return [
    formatAttendance(s),
    s.position && `Stand: ${s.position}`,
    s.tajweedRating != null && `Tadschwid ${s.tajweedRating}/5`,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Reiter "Teilnehmer": eingeschriebene Teilnehmer, Einladen und Warteliste.
export default async function CourseParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { course } = await requireManagedCourse(id);

  const [enrollments, waitlist] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId: id },
      include: { participant: true, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.waitlistEntry.findMany({ where: { courseId: id }, orderBy: { createdAt: "asc" } }),
  ]);

  const capacity = capacityOf(course.maxParticipants, enrollments.length);
  const dateFormat = new Intl.DateTimeFormat("de-DE");
  const progress = await getProgressSummaries(
    course.id,
    enrollments.map((e) => e.participantId),
  );
  const rows: ParticipantRow[] = enrollments.map(({ id: enrollmentId, participant, user, createdAt }) => ({
    enrollmentId,
    name: nameWithMuslimName(participant),
    detail:
      participant.relation === "CHILD"
        ? `(Kind${participant.birthYear ? `, Jahrgang ${participant.birthYear}` : ""})`
        : "",
    contact: participant.email ?? `über ${user.name}: ${user.email}`,
    since: dateFormat.format(createdAt),
    progress: progressLine(progress.get(participant.id)),
    profileHref: `/teacher/schueler/${participant.id}`,
    messageHref: `/teacher/courses/${course.id}/nachrichten?an=${participant.id}`,
  }));

  return (
    <div className="space-y-8">
      <section aria-labelledby="teilnehmer" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="teilnehmer" className="font-semibold text-azure-800">
            Teilnehmer ({enrollments.length})
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            {capacity.max != null && (
              <span
                className={`px-3 py-0.5 text-xs font-semibold text-white ${capacity.isFull ? "bg-azure-800" : "bg-brass"}`}
              >
                {capacity.taken} von {capacity.max} Plätzen belegt
                {capacity.taken > capacity.max ? " (überbucht)" : ""}
              </span>
            )}
            {course.isPublished && (
              <Link href={`/teacher/schueler/einladen?kurs=${course.id}`} className="text-sm font-medium text-azure-800 underline">
                Schüler einladen
              </Link>
            )}
          </div>
        </div>
        {!course.isPublished && (
          <p className="text-sm text-brand-800">Einladen ist möglich, sobald der Kurs veröffentlicht ist.</p>
        )}
        <ParticipantsList rows={rows} />
      </section>

      <section aria-labelledby="warteliste" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="warteliste" className="font-semibold text-azure-800">
            Warteliste ({waitlist.length})
          </h2>
          <span className="text-xs text-brand-600">sortiert nach Eintragsdatum, älteste zuerst</span>
        </div>
        {waitlist.length === 0 ? (
          <p className="text-sm text-brand-600">Niemand wartet auf einen Platz.</p>
        ) : (
          <ol className="divide-y divide-brand-100 border border-gold-400/40 bg-white text-sm">
            {waitlist.map((entry, index) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-gold-400/60 bg-brand-100 font-display text-base font-bold text-azure-800">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-brand-900">
                    {entry.name} <span className="font-normal text-brand-600">· {entry.email}</span>
                  </p>
                  <p className="text-xs text-brand-700">
                    eingetragen am {dateFormat.format(entry.createdAt)}
                    {entry.contactedAt ? ` · angeschrieben am ${dateFormat.format(entry.contactedAt)}` : ""}
                  </p>
                </div>
                <WaitlistContactButton entryId={entry.id} name={entry.name} />
                <RemoveForm
                  action={removeWaitlistEntry}
                  fields={{ entryId: entry.id }}
                  message={`${entry.name} von der Warteliste entfernen?`}
                />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
