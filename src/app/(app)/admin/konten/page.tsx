import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ROLE_LABEL = { STUDENT: "Schüler", TEACHER: "Lehrer", ADMIN: "Admin" } as const;

// Konten suchen (Name oder E-Mail) und Schueler- oder Lehrer-Konten loeschen, z. B. auf Loeschanfrage.
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; geloescht?: string; alteAbos?: string }>;
}) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const query = await searchParams;
  const q = (query.q ?? "").trim();
  const oldSubscriptions = (query.alteAbos ?? "").split(",").filter((id) => /^sub_\w+$/.test(id));
  const users = q
    ? await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          _count: { select: { participants: true, enrollments: true } },
        },
      })
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-azure-800">Konten</h1>
        <p className="mt-2 text-sm text-brand-700">
          Konto per Name oder E-Mail-Adresse suchen. Schüler- und Lehrer-Konten lassen sich hier
          vollständig löschen, z. B. auf Löschanfrage. Die Kurse einer Lehrkraft werden vorher einer
          anderen Lehrkraft zugeordnet.
        </p>
      </div>

      {query.geloescht && (
        <p role="status" className="bg-green-50 px-4 py-3 text-sm text-green-900">
          Das Konto wurde gelöscht.
        </p>
      )}
      {oldSubscriptions.length > 0 && (
        <div className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-medium">Bitte im früheren Stripe-Konto von Hand kündigen:</p>
          <p className="mt-1">
            Diese Abos gibt es im aktuell verbundenen Stripe-Konto nicht. Werden sie dort nicht
            gekündigt, bucht Stripe weiter ab.
          </p>
          <ul className="mt-2 list-disc pl-5 font-mono text-xs">
            {oldSubscriptions.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
        </div>
      )}

      <form className="flex flex-wrap gap-2" action="/admin/konten">
        <label className="sr-only" htmlFor="q">
          Name oder E-Mail
        </label>
        <input
          id="q"
          name="q"
          defaultValue={q}
          placeholder="Name oder E-Mail"
          className="min-w-0 flex-1 border border-brand-300 bg-white px-3 py-2 text-sm"
        />
        <button className="btn-primary px-4 py-2">Suchen</button>
      </form>

      {q && (
        <section className="border border-gold-400/40 bg-white p-5">
          {users.length === 0 ? (
            <p className="text-sm text-brand-600">Kein Konto gefunden.</p>
          ) : (
            <ul className="divide-y divide-brand-100 text-sm">
              {users.map((user) => (
                <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-brand-900">
                      {user.name} <span className="font-normal text-brand-600">({ROLE_LABEL[user.role]})</span>
                    </p>
                    <p className="break-all text-brand-600">
                      {user.email} · seit {new Intl.DateTimeFormat("de-DE").format(user.createdAt)} ·{" "}
                      {user._count.participants} Teilnehmer, {user._count.enrollments} Anmeldungen
                    </p>
                  </div>
                  {user.role !== "ADMIN" && user.id !== session.user.id && (
                    <Link href={`/admin/konten/${user.id}`} className="shrink-0 font-medium text-red-800 underline">
                      Konto löschen …
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
