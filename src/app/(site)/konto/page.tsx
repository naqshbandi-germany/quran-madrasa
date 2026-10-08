import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ParticipantEditor, PasswordForm, ProfileForm } from "./konto-forms";

export const metadata = { title: "Mein Konto – Quran Madrasa" };

// Hängt von der Anmeldung ab und darf nicht zwischengespeichert werden.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin?callbackUrl=/konto");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const participants = await prisma.participant.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
    include: { enrollments: { select: { course: { select: { title: true } } } } },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <div>
        <h1 className="text-4xl font-semibold text-brand-900">Mein Konto</h1>
        <p className="mt-1 text-brand-900/75">
          Hier verwaltest du deine Angaben, dein Passwort und die Personen, die du zu Kursen
          anmeldest.
        </p>
      </div>

      <section aria-labelledby="profil" className="space-y-4">
        <h2 id="profil" className="text-2xl font-semibold text-brand-900">
          Profil
        </h2>
        <ProfileForm name={user.name} email={user.email} />
      </section>

      <section aria-labelledby="passwort" className="space-y-4">
        <h2 id="passwort" className="text-2xl font-semibold text-brand-900">
          Passwort ändern
        </h2>
        <PasswordForm />
        <p className="text-sm text-brand-900/70">
          Du hast dich mit Google angemeldet oder dein Passwort vergessen?{" "}
          <Link href="/auth/passwort-vergessen" className="font-medium text-azure-800 underline">
            Neues Passwort per E-Mail festlegen
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="teilnehmer" className="space-y-4">
        <h2 id="teilnehmer" className="text-2xl font-semibold text-brand-900">
          Meine Teilnehmer
        </h2>
        <p className="text-brand-900/75">
          Das sind die Personen, die du angemeldet hast. Neue Teilnehmer legst du bei der
          Anmeldung zu einem Kurs an.
        </p>
        {participants.length === 0 ? (
          <p className="rounded-md border border-brand-200 bg-white p-4 text-sm text-brand-900/75">
            Du hast noch keine Teilnehmer.{" "}
            <Link href="/" className="font-medium text-azure-800 underline">
              Zum Kursangebot
            </Link>
          </p>
        ) : (
          <ul className="space-y-3">
            {participants.map((participant) => (
              <li key={participant.id}>
                <ParticipantEditor
                  participant={{
                    id: participant.id,
                    name: participant.name,
                    relation: participant.relation,
                    birthYear: participant.birthYear,
                    email: participant.email,
                    whatsapp: participant.whatsapp,
                    courses: participant.enrollments.map((e) => e.course.title),
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="abos" className="space-y-3">
        <h2 id="abos" className="text-2xl font-semibold text-brand-900">
          Kurse und Abos
        </h2>
        <p className="text-brand-900/75">
          Deine Kurse mit den nächsten Terminen findest du unter{" "}
          <Link href="/dashboard" className="font-medium text-azure-800 underline">
            Meine Kurse
          </Link>
          . Zahlungsmethode, Rechnungen und Kündigung verwaltest du unter{" "}
          <Link href="/dashboard/billing" className="font-medium text-azure-800 underline">
            Abo verwalten
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="loeschen" className="space-y-2 border-t border-brand-200 pt-6">
        <h2 id="loeschen" className="text-lg font-semibold text-brand-900">
          Konto und Daten löschen
        </h2>
        <p className="text-sm text-brand-900/75">
          Du möchtest dein Konto und alle zugehörigen Daten löschen lassen? Beende zuerst deine
          Abos und schreibe uns kurz an{" "}
          <a href="mailto:admin@islamunterfreunden.de" className="font-medium text-azure-800 underline">
            admin@islamunterfreunden.de
          </a>
          .
        </p>
      </section>
    </div>
  );
}
