import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ManageBillingButton } from "./manage-billing-button";

export default async function BillingPage() {
  const session = await auth();
  if (!session) return null;

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      // Familien-Abo: alle Plaetze (Kind und Kurs) anzeigen
      enrollments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, participant: { select: { name: true } }, course: { select: { title: true } } },
      },
    },
  });

  const courses = await prisma.course.findMany({
    where: { id: { in: subscriptions.flatMap((s) => (s.courseId ? [s.courseId] : [])) } },
  });
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-azure-800">Abo verwalten</h1>
      <p className="text-brand-600">
        Alle Abos sind monatlich kündbar. Die Verwaltung (Kündigung, Zahlungsmethode ändern,
        Rechnungen) läuft über unser sicheres Stripe-Kundenportal.
      </p>

      <div className="space-y-3">
        {subscriptions.map((subscription) => {
          const course = subscription.courseId ? courseById.get(subscription.courseId) : undefined;
          return (
            <div
              key={subscription.id}
              className="flex items-center justify-between border border-gold-400/40 bg-white p-4"
            >
              <div>
                <p className="font-medium text-brand-700">
                  {subscription.family ? "Familienpreis Kinderkurse" : (course?.title ?? subscription.courseId)}
                </p>
                {subscription.family && subscription.enrollments.length > 0 && (
                  <ul className="mt-1 text-sm text-brand-700">
                    {subscription.enrollments.map((e) => (
                      <li key={e.id}>
                        {e.participant.name} · {e.course.title}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-brand-600">
                  Status: {subscription.status}
                  {subscription.cancelAtPeriodEnd &&
                    " · endet am " +
                      new Intl.DateTimeFormat("de-DE").format(subscription.currentPeriodEnd)}
                </p>
                {subscription.family && (
                  <p className="mt-1 text-xs text-brand-600">
                    Eine Kündigung im Kundenportal beendet alle Plätze dieses Familien-Abos. Soll nur ein Kind aus
                    einem Kurs abgemeldet werden, schreib bitte der Lehrkraft.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {subscriptions.length > 0 && <ManageBillingButton />}
    </div>
  );
}
