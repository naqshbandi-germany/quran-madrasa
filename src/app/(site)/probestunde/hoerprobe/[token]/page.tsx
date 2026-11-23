import { callName } from "@/lib/names";
import type { Metadata } from "next";
import Link from "next/link";

import { GuestSampleDeleteButton } from "./delete-button";
import { ReadingSampleRecorder } from "@/components/reading-sample-recorder";
import { formatReminderDate } from "@/lib/reminder-email";
import { formatGermanDateTime } from "@/lib/schedule-time";
import { findSampleSource } from "@/lib/trial-samples";

// Persoenlicher Link eines Probestunden-Gastes bzw. einer zum Kurs eingeladenen Person zum
// Aufnehmen der Hoerprobe (ohne Konto). Auch unter /einladung/hoerprobe/<token> erreichbar.
// Nicht zwischenspeichern und nicht indexieren.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hörprobe", robots: { index: false, follow: false } };

function formatDuration(seconds: number | null) {
  if (!seconds) return "";
  return ` · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} Min.`;
}

export default async function TrialSamplePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const guest = await findSampleSource(token);

  if (!guest) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-3xl font-semibold text-azure-800">Link nicht mehr gültig</h1>
        <p className="text-brand-900/80">
          Dieser Link zur Hörprobe ist abgelaufen, die Probestunde wurde abgesagt, die Hörprobe ist schon deinem
          Konto zugeordnet oder der Link ist unvollständig.
          Bitte wende dich an die Lehrkraft, die dich eingeladen hat.
        </p>
        <Link href="/" className="font-medium text-azure-800 underline">
          Zur Startseite
        </Link>
      </div>
    );
  }

  const { course } = guest;
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-azure-700">
          {guest.kind === "trial" ? "Probestunde" : "Einladung zum Kurs"}
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-azure-800">
          Salam alaykum{guest.name ? ` ${guest.name}` : ""}!
        </h1>
        {guest.kind === "trial" && guest.startsAt ? (
          <p className="mt-2 text-brand-900/80">
            {callName(course.teacher)} bittet dich vor deiner Probestunde im Kurs{" "}
            <span className="font-medium">{course.title}</span> am {formatReminderDate(guest.startsAt)} um eine kurze
            Hörprobe. So kann sich die Lehrkraft gezielt auf dich vorbereiten. Ein Konto brauchst du dafür nicht.
          </p>
        ) : (
          <p className="mt-2 text-brand-900/80">
            {callName(course.teacher)} hat dich zum Kurs <span className="font-medium">{course.title}</span> eingeladen und
            bittet dich um eine kurze Hörprobe. So kann sich die Lehrkraft gezielt auf dich vorbereiten. Ein Konto
            brauchst du dafür nicht; du kannst die Hörprobe auch schon vor der Anmeldung schicken. Meldest du dich
            später mit derselben E-Mail-Adresse an, wird sie deinem Konto zugeordnet.
          </p>
        )}
      </div>

      <p className="border-l-2 border-gold-400 bg-brand-50 px-3 py-2 text-sm">
        <span className="font-semibold text-azure-800">Bitte lies vor:</span> {guest.sampleRequest}
      </p>

      <ReadingSampleRecorder
        courseId={course.id}
        participants={[]}
        sessions={[]}
        guestToken={token}
      />

      {guest.samples.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-azure-800">Deine Hörproben</h2>
          <ul className="space-y-3">
            {guest.samples.map((s) => (
              <li key={s.id} className="space-y-2 border border-gold-400/40 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-brand-700">
                    {formatGermanDateTime(s.createdAt)} Uhr{formatDuration(s.durationSec)}
                  </p>
                  <span className={`text-xs ${s.listenedAt ? "text-green-800" : "text-brand-600"}`}>
                    {s.listenedAt ? "✓ von der Lehrkraft gehört" : "noch nicht gehört"}
                  </span>
                </div>
                <audio
                  controls
                  preload="none"
                  src={`/api/probestunde/hoerprobe/${s.id}?t=${encodeURIComponent(token)}`}
                  className="w-full"
                />
                {s.note && <p className="text-brand-700">Dein Hinweis: {s.note}</p>}
                <GuestSampleDeleteButton sampleId={s.id} token={token} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
