import { SubscriptionStatus } from "@prisma/client";
import type Stripe from "stripe";

import { prisma } from "@/lib/prisma";

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "active":
    case "trialing":
      return SubscriptionStatus.ACTIVE;
    case "past_due":
    case "unpaid":
      return SubscriptionStatus.PAST_DUE;
    case "canceled":
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

// Gleicht ein Stripe-Abo mit der Datenbank ab: Abo-Datensatz aktualisieren und die
// Teilnehmer aus den Metadaten (participantIds) einschreiben oder bei Kuendigung wieder
// austragen. Wird fuer jedes Stripe-Ereignis zum Abo aufgerufen und ist idempotent.
export async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const courseId = subscription.metadata.courseId;
  if (!userId || !courseId) return;

  // Seit neueren Stripe-API-Versionen liegt current_period_end an den Items. Wir haben
  // immer genau eine Position pro Abo; deren Menge ist die Zahl der Teilnehmer.
  const item = subscription.items.data[0];
  const data = {
    userId,
    courseId,
    status: mapStripeStatus(subscription.status),
    currentPeriodEnd: new Date((item?.current_period_end ?? 0) * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    quantity: item?.quantity ?? 1,
  };

  const saved = await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: { stripeSubscriptionId: subscription.id, ...data },
    update: data,
  });

  if (data.status === "CANCELED") {
    // Abo beendet: Teilnahme entfaellt (Zugang zu Sitzungen und Mails).
    await prisma.enrollment.deleteMany({ where: { subscriptionId: saved.id } });
    return;
  }

  if (data.status !== "ACTIVE") return;

  let participantIds = (subscription.metadata.participantIds ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  // Abos aus der Zeit vor den Teilnehmern: der Konto-Inhaber nimmt selbst teil.
  if (participantIds.length === 0) {
    const linked = await prisma.enrollment.count({ where: { subscriptionId: saved.id } });
    if (linked > 0) return;
    const owner = await prisma.user.findUnique({ where: { id: userId } });
    if (!owner) return;
    const self =
      (await prisma.participant.findFirst({ where: { ownerId: userId, relation: "SELF" } })) ??
      (await prisma.participant.create({
        data: { ownerId: userId, name: owner.name, relation: "SELF", email: owner.email },
      }));
    participantIds = [self.id];
  }

  // Nur Teilnehmer dieses Kontos zulassen.
  const participants = await prisma.participant.findMany({
    where: { id: { in: participantIds }, ownerId: userId },
    select: { id: true },
  });

  for (const participant of participants) {
    await prisma.enrollment.upsert({
      where: { participantId_courseId: { participantId: participant.id, courseId } },
      create: { userId, participantId: participant.id, courseId, subscriptionId: saved.id },
      update: { subscriptionId: saved.id },
    });
  }
}
