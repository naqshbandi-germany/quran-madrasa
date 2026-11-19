import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { REVIEW_SAMPLE_SELECT, ReadingSampleReviewList } from "@/components/reading-sample-review-list";
import { prisma } from "@/lib/prisma";
import { READING_SAMPLE_RETENTION_DAYS } from "@/lib/reading-samples";
import { formatZonedDateTime } from "@/lib/schedule-time";
import { toggleTrialSampleListened } from "@/lib/trial-actions";
import { resolveViewTimeZone } from "@/lib/view-time-zone";

export default async function TeacherReadingSamplesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const course = await prisma.course.findUnique({ where: { id }, select: { id: true, title: true, teacherId: true } });
  if (!course) notFound();
  const session = await auth();
  if (!session || (session.user.role !== "ADMIN" && session.user.id !== course.teacherId)) notFound();

  const [samples, invitations, { timeZone }] = await Promise.all([
    prisma.readingSample.findMany({
      where: { courseId: id },
      // Ungehoerte zuerst, darin die neuesten oben.
      orderBy: [{ listenedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      select: REVIEW_SAMPLE_SELECT,
    }),
    // Einladungen mit erbetener Hoerprobe, deren Aufnahmen noch keinem Teilnehmer zugeordnet
    // sind (die Person hat sich noch nicht angemeldet).
    prisma.invitation.findMany({
      where: { courseId: id, sampleRequest: { not: null }, OR: [{ expiresAt: { gt: new Date() } }, { samples: { some: {} } }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        sampleRequest: true,
        createdAt: true,
        samples: {
          orderBy: { createdAt: "desc" },
          select: { id: true, createdAt: true, durationSec: true, note: true, listenedAt: true },
        },
      },
    }),
    resolveViewTimeZone(session.user.id),
  ]);
  const unheard =
    samples.filter((s) => !s.listenedAt).length +
    invitations.reduce((sum, i) => sum + i.samples.filter((s) => !s.listenedAt).length, 0);
  const when = (date: Date) => `${formatZonedDateTime(date, timeZone)} Uhr`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-azure-800">Leseproben</h1>
        <p className="text-sm text-brand-600">
          {unheard > 0 ? `${unheard} noch nicht gehört. ` : ""}
          Nur du und der Admin können die Aufnahmen hören, andere Teilnehmer nicht. Sie werden nach{" "}
          {Math.round(READING_SAMPLE_RETENTION_DAYS / 30)} Monaten automatisch gelöscht. Um eine
          Leseprobe zu bitten, trage bei einer Sitzung unter &bdquo;Inhalt &amp; Hausaufgabe&ldquo; den
          Abschnitt ein, fordere sie unter &bdquo;Nachrichten&ldquo; an oder bitte schon beim Einladen darum.
        </p>
      </div>

      {invitations.length > 0 && (
        <section className="space-y-3 border border-gold-400/40 bg-white p-5">
          <h2 className="font-semibold text-azure-800">Eingeladen, noch nicht angemeldet</h2>
          <p className="text-sm text-brand-600">
            Hörproben, die bei der Einladung erbeten wurden. Meldet sich die Person mit derselben E-Mail-Adresse an,
            wandert die Aufnahme in ihr Schülerprofil und erscheint unten.
          </p>
          <ul className="divide-y divide-brand-100">
            {invitations.map((inv) => (
              <li key={inv.id} className="space-y-1 py-3 text-sm">
                <p className="text-brand-900">
                  <span className="font-medium">{inv.name || "Ohne Namen"}</span>
                  {inv.email && <span className="text-brand-600"> · {inv.email}</span>}
                  <span className="text-brand-600"> · eingeladen am {when(inv.createdAt)}</span>
                </p>
                <div className="space-y-1 border-l-2 border-gold-400 pl-2 text-xs text-brand-700">
                  <p>
                    Hörprobe erbeten: {inv.sampleRequest}
                    {inv.samples.length === 0 && <span className="text-brand-500"> · noch keine Aufnahme</span>}
                  </p>
                  {inv.samples.map((s) => (
                    <div key={s.id} className="space-y-1">
                      <audio controls preload="none" src={`/api/probestunde/hoerprobe/${s.id}`} className="h-8 w-full max-w-xs" />
                      <div className="flex flex-wrap items-center gap-2">
                        <span>
                          {when(s.createdAt)}
                          {s.durationSec
                            ? ` · ${Math.floor(s.durationSec / 60)}:${String(s.durationSec % 60).padStart(2, "0")} Min.`
                            : ""}
                        </span>
                        <form action={toggleTrialSampleListened}>
                          <input type="hidden" name="sampleId" value={s.id} />
                          <button
                            type="submit"
                            className={s.listenedAt ? "text-green-800" : "font-medium text-azure-800 underline"}
                          >
                            {s.listenedAt ? "✓ gehört" : "Als gehört markieren"}
                          </button>
                        </form>
                      </div>
                      {s.note && <p>Hinweis: {s.note}</p>}
                    </div>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReadingSampleReviewList samples={samples} />
    </div>
  );
}
