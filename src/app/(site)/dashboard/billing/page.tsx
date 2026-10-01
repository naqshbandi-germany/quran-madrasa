import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ManageBillingButton } from "./manage-billing-button";

export default async function BillingPage() {
  const session = await auth();
  if (!session) return null;

  const subscriptions = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const courses = await prisma.course.findMany({
    where: { id: { in: subscriptions.map((s) => s.courseId) } },
  });
  const courseById = new Map(courses.map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Abo verwalten</h1>
      <p className="text-brand-600">
        Alle Abos sind monatlich kündbar. Die Verwaltung (Kündigung, Zahlungsmethode ändern,
        Rechnungen) läuft über unser sicheres Stripe-Kundenportal.
      </p>

      <div className="space-y-3">
        {subscriptions.map((subscription) => {
          const course = courseById.get(subscription.courseId);
          return (
            <div
              key={subscription.id}
              className="flex items-center justify-between rounded-lg border border-brand-200 bg-white p-4"
            >
              <div>
                <p className="font-medium text-brand-700">{course?.title ?? subscription.courseId}</p>
                <p className="text-sm text-brand-600">
                  Status: {subscription.status}
                  {subscription.cancelAtPeriodEnd &&
                    " · endet am " +
                      new Intl.DateTimeFormat("de-DE").format(subscription.currentPeriodEnd)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {subscriptions.length > 0 && <ManageBillingButton />}
    </div>
  );
}
