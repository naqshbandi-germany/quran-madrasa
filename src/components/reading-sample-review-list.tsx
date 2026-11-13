import { ConfirmButton } from "@/components/confirm-button";
import { deleteReadingSample, reviewReadingSample } from "@/lib/reading-sample-actions";
import { formatGermanDateTime } from "@/lib/schedule-time";

export type ReviewSample = {
  id: string;
  createdAt: Date;
  durationSec: number | null;
  note: string | null;
  listenedAt: Date | null;
  teacherComment: string | null;
  participant: { name: string };
  session: { title: string; startsAt: Date } | null;
};

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  return ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} Min.`;
}

// Leseproben fuer die Lehrkraft: abspielen, als gehoert markieren, Rueckmeldung schreiben.
export function ReadingSampleReviewList({ samples }: { samples: ReviewSample[] }) {
  if (samples.length === 0) return <p className="text-sm text-brand-600">Noch keine Leseproben.</p>;
  return (
    <ul className="space-y-3">
      {samples.map((s) => (
        <li
          key={`${s.id}-${s.listenedAt?.getTime() ?? 0}-${s.teacherComment ?? ""}`}
          className={`space-y-2 border bg-white p-4 text-sm ${s.listenedAt ? "border-gold-400/40" : "border-azure-800/60"}`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-medium text-brand-900">
              {s.participant.name}
              <span className="font-normal text-brand-600">
                {" "}
                · {formatGermanDateTime(s.createdAt)} Uhr{formatDuration(s.durationSec)}
                {s.session ? ` · für ${s.session.title} am ${formatGermanDateTime(s.session.startsAt)} Uhr` : ""}
              </span>
            </p>
            {!s.listenedAt && <span className="bg-azure-800 px-2 py-0.5 text-xs font-semibold text-white">neu</span>}
          </div>
          <audio controls preload="none" src={`/api/leseproben/${s.id}`} className="w-full" />
          {s.note && <p className="text-brand-700">Hinweis: {s.note}</p>}
          <form action={reviewReadingSample} className="space-y-2">
            <input type="hidden" name="sampleId" value={s.id} />
            <textarea
              name="comment"
              rows={2}
              maxLength={2000}
              defaultValue={s.teacherComment ?? ""}
              placeholder="Rückmeldung an den Teilnehmer (optional)"
              aria-label={`Rückmeldung an ${s.participant.name}`}
              className="w-full border border-brand-300 px-3 py-2"
            />
            <div className="flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-1.5">
                <input type="checkbox" name="listened" value="1" defaultChecked={Boolean(s.listenedAt)} />
                gehört
              </label>
              <button className="btn-primary px-3 py-1">Speichern</button>
            </div>
          </form>
          <form action={deleteReadingSample}>
            <input type="hidden" name="sampleId" value={s.id} />
            <ConfirmButton
              message={`Leseprobe von ${s.participant.name} endgültig löschen?`}
              className="text-xs font-medium text-red-800 underline hover:text-red-700"
            >
              Löschen
            </ConfirmButton>
          </form>
        </li>
      ))}
    </ul>
  );
}

export const REVIEW_SAMPLE_SELECT = {
  id: true,
  createdAt: true,
  durationSec: true,
  note: true,
  listenedAt: true,
  teacherComment: true,
  participant: { select: { name: true } },
  session: { select: { title: true, startsAt: true } },
} as const;
