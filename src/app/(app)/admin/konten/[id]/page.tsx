import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { DeleteAccountForm } from "@/components/delete-account-form";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Zusammenfassung eines Kontos vor dem Loeschen (was alles wegfaellt), bei Lehrkraeften mit
// Zuordnung der Kurse und der Mediathek an eine andere Lehrkraft, plus Sicherheitsabfrage.
export default async function DeleteAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      participants: { select: { name: true, _count: { select: { readingSamples: true } } } },
      enrollments: { select: { participant: { select: { name: true } }, course: { select: { title: true } } } },
      subscriptions: { where: { status: { not: "CANCELED" } }, select: { id: true } },
      taughtCourses: {
        orderBy: { title: "asc" },
        select: { id: true, title: true, isPublished: true, isHidden: true, _count: { select: { enrollments: true } } },
      },
      _count: { select: { mediaFiles: true } },
    },
  });
  if (!user) notFound();

  const isTeacher = user.role === "TEACHER";
  const otherTeachers = isTeacher
    ? await prisma.user.findMany({
        where: { role: "TEACHER", id: { not: user.id } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, email: true },
      })
    : [];
  const samples = user.participants.reduce((sum, p) => sum + p._count.readingSamples, 0);
  const needsTeacher = user.taughtCourses.length > 0 || user._count.mediaFiles > 0;
  const blocked = user.role === "ADMIN" || user.id === session.user.id;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/admin/konten?q=${encodeURIComponent(user.email)}`} className="text-sm text-brand-700 underline">
          ← Konten
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-azure-800">{isTeacher ? "Lehrer-Konto löschen" : "Konto löschen"}</h1>
        <p className="mt-1 break-all text-sm text-brand-700">
          {user.name} · {user.email}
        </p>
      </div>

      {blocked ? (
        <p className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          Admin-Konten und das eigene Konto lassen sich hier nicht löschen.
        </p>
      ) : isTeacher && needsTeacher && otherTeachers.length === 0 ? (
        <p className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          Die Kurse und die Mediathek dieses Kontos brauchen eine neue Lehrkraft. Bitte zuerst im{" "}
          <Link href="/admin#lehrer" className="underline">
            Admin-Bereich
          </Link>{" "}
          eine andere Lehrkraft einladen.
        </p>
      ) : (
        <>
          <section className="border border-gold-400/40 bg-white p-5 text-sm text-brand-900">
            <h2 className="mb-2 font-semibold text-azure-800">Das wird gelöscht</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Konto mit Profil{isTeacher && " (Foto, Vita, Zoom-E-Mail)"} und Kalender-Abo</li>
              {(!isTeacher || user.participants.length > 0) && (
                <>
                  <li>
                    {user.participants.length} Teilnehmer
                    {user.participants.length > 0 && `: ${user.participants.map((p) => p.name).join(", ")}`}
                  </li>
                  <li>
                    {user.enrollments.length} Kurs-Anmeldungen
                    {user.enrollments.length > 0 &&
                      `: ${user.enrollments.map((e) => `${e.participant.name} in ${e.course.title}`).join(", ")}`}
                  </li>
                  <li>Anwesenheit, Lernfortschritt und {samples} Leseproben dieser Teilnehmer</li>
                  <li>
                    {user.subscriptions.length} laufende Abos: werden bei Stripe sofort gekündigt, ohne
                    Rückerstattung für den laufenden Monat
                  </li>
                </>
              )}
              <li>Einträge auf Wartelisten mit dieser E-Mail-Adresse</li>
            </ul>
            {isTeacher && (
              <p className="mt-3 text-brand-700">
                Die Kurse bleiben bestehen, mit allen Terminen, Teilnehmern, Anwesenheiten und
                Leseproben. Sie bekommen unten eine neue Lehrkraft.
              </p>
            )}
            <p className="mt-3 text-brand-700">
              Zahlungsbelege bleiben bei Stripe erhalten (Aufbewahrungspflicht). Das Löschen lässt
              sich nicht rückgängig machen.
            </p>
          </section>

          <DeleteAccountForm
            userId={user.id}
            email={user.email}
            courses={user.taughtCourses.map((c) => ({
              id: c.id,
              title: c.title,
              detail: `${!c.isPublished ? "nicht veröffentlicht" : c.isHidden ? "versteckt" : "veröffentlicht"} · ${c._count.enrollments} Teilnehmer`,
            }))}
            mediaCount={user._count.mediaFiles}
            teachers={otherTeachers}
          />
        </>
      )}
    </div>
  );
}
