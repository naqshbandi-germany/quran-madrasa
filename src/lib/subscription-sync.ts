import { SubscriptionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { sendEnrollmentConfirmation } from "@/lib/notification-email";
import { recordEvent } from "@/lib/notifications";
import { callName, fullName } from "@/lib/names";
import { adoptTrialSamplesSafely } from "@/lib/trial-samples";
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
// Familien-Abo (metadata.family): courseId und participantIds beschreiben nur die erste
// Anmeldung; spaeter dazugebuchte Plaetze (auch in anderen Kursen) stehen nur in der Datenbank.
export async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  const courseId = subscription.metadata.courseId;
  const family = subscription.metadata.family === "1";
  if (!userId || !courseId) return;

  // Seit neueren Stripe-API-Versionen liegt current_period_end an den Items. Wir haben
  // immer genau eine Position pro Abo; deren Menge ist die Zahl der Teilnehmer.
  const item = subscription.items.data[0];
  const data = {
    userId,
    courseId: family ? null : courseId,
    family,
    status: mapStripeStatus(subscription.status),
    currentPeriodEnd: new Date((item?.current_period_end ?? 0) * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    quantity: item?.quantity ?? 1,
  };

  // Vorheriger Stand, um Kuendigung und Ende des Abos zu erkennen.
  const previous = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
    select: { status: true, cancelAtPeriodEnd: true },
  });

  const saved = await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    create: { stripeSubscriptionId: subscription.id, ...data },
    update: data,
  });

  // Belegte Plaetze aendern sich: Kursseiten ("ausgebucht") neu erzeugen.
  const refreshCourses = () => {
    revalidatePath("/courses/[slug]", "page");
    revalidatePath("/");
    revalidatePath("/quran");
  };

  if (data.status === "CANCELED") {
    // Abo beendet: Teilnahme entfaellt (Zugang zu Sitzungen und Mails). Beim Familien-Abo
    // betrifft das mehrere Kurse: je Kurs eine Meldung an die Lehrkraft.
    const ended = previous && previous.status !== "CANCELED";
    const perCourse = ended ? await subscriptionEventsByCourse(saved.id, userId, courseId) : [];
    await prisma.enrollment.deleteMany({ where: { subscriptionId: saved.id } });
    refreshCourses();
    for (const { courseId: affected, data: eventData } of perCourse) {
      await recordEvent({
        type: "SUBSCRIPTION_ENDED",
        dedupeKey: `subscription-ended:${subscription.id}:${affected}`,
        courseId: affected,
        data: eventData,
      });
    }
    return;
  }

  // Zum Ende des Zeitraums gekuendigt (vorher nicht): Lehrkraft informieren. Der Zeitraum steht
  // im Schluessel, damit eine spaetere erneute Kuendigung wieder gemeldet wird.
  if (data.cancelAtPeriodEnd && previous && !previous.cancelAtPeriodEnd) {
    const periodEnd = data.currentPeriodEnd.toLocaleDateString("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Berlin",
    });
    for (const { courseId: affected, data: eventData } of await subscriptionEventsByCourse(saved.id, userId, courseId)) {
      await recordEvent({
        type: "SUBSCRIPTION_CANCELED",
        dedupeKey: `subscription-canceled:${subscription.id}:${affected}:${data.currentPeriodEnd.getTime()}`,
        courseId: affected,
        data: { ...eventData, periodEnd },
      });
    }
  }

  if (data.status !== "ACTIVE") return;

  // Familien-Abo: Teilnehmer aus den Metadaten nur bei der ersten Anmeldung einschreiben.
  // Danach verwaltet die Website die Plaetze selbst (Dazubuchen, Austragen); sonst kaemen
  // ausgetragene Teilnehmer beim naechsten Stripe-Ereignis wieder zurueck.
  if (family && (await prisma.enrollment.count({ where: { subscriptionId: saved.id } })) > 0) return;

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
        data: { ownerId: userId, name: owner.name, muslimName: owner.muslimName, relation: "SELF", email: owner.email },
      }));
    participantIds = [self.id];
  }

  // Nur Teilnehmer dieses Kontos zulassen.
  const participants = await prisma.participant.findMany({
    where: { id: { in: participantIds }, ownerId: userId },
    select: { id: true },
  });

  // Bereits eingeschriebene Teilnehmer erkennen, damit die Bestaetigungs-Mail nur einmal geht
  // (Stripe schickt pro Abo mehrere Ereignisse).
  const alreadyEnrolled = new Set(
    (
      await prisma.enrollment.findMany({
        where: { courseId, participantId: { in: participants.map((p) => p.id) } },
        select: { participantId: true },
      })
    ).map((e) => e.participantId),
  );

  const newEnrollmentIds: string[] = [];
  for (const participant of participants) {
    const enrollment = await prisma.enrollment.upsert({
      where: { participantId_courseId: { participantId: participant.id, courseId } },
      create: { userId, participantId: participant.id, courseId, subscriptionId: saved.id },
      update: { subscriptionId: saved.id },
    });
    if (!alreadyEnrolled.has(participant.id)) newEnrollmentIds.push(enrollment.id);
  }
  refreshCourses();

  const newParticipantIds = participants.map((p) => p.id).filter((id) => !alreadyEnrolled.has(id));
  // Hoerproben aus einer Probestunde (gleiche E-Mail-Adresse) dem Teilnehmer zuordnen.
  await adoptTrialSamplesSafely(courseId, newParticipantIds);
  if (newEnrollmentIds.length > 0) {
    const eventData = await subscriptionEventData(saved.id, userId, courseId, newEnrollmentIds);
    await recordEvent({
      type: "ENROLLMENT_CREATED",
      dedupeKey: `enrollment:${[...newEnrollmentIds].sort().join(",")}`,
      courseId,
      participantId: newParticipantIds.length === 1 ? newParticipantIds[0] : null,
      data: eventData,
    });
  }

  try {
    await sendEnrollmentConfirmation(courseId, newEnrollmentIds);
  } catch (err) {
    console.error("Bestätigungs-Mail nach der Anmeldung fehlgeschlagen:", err);
  }
}

// Meldungen je Kurs fuer ein Abo: beim Familien-Abo alle Kurse mit Teilnehmern des Abos, sonst
// der Kurs des Abos.
async function subscriptionEventsByCourse(subscriptionId: string, userId: string, fallbackCourseId: string) {
  const linked = await prisma.enrollment.findMany({
    where: { subscriptionId },
    select: { courseId: true },
    distinct: ["courseId"],
  });
  const courseIds = linked.length > 0 ? linked.map((e) => e.courseId) : [fallbackCourseId];
  return Promise.all(
    courseIds.map(async (id) => ({ courseId: id, data: await subscriptionEventData(subscriptionId, userId, id) })),
  );
}

// Namen fuer Benachrichtigungen: Kurs, Konto-Inhaber und die Teilnehmer des Abos in diesem Kurs
// (bzw. nur die angegebenen Einschreibungen).
async function subscriptionEventData(
  subscriptionId: string,
  userId: string,
  courseId: string,
  enrollmentIds?: string[],
) {
  const [course, owner, enrollments] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId }, select: { title: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.enrollment.findMany({
      where: enrollmentIds ? { id: { in: enrollmentIds } } : { subscriptionId, courseId },
      orderBy: { createdAt: "asc" },
      select: { participant: { select: { name: true, muslimName: true } } },
    }),
  ]);
  return {
    course: course?.title,
    owner: owner?.name,
    participants: enrollments.map((e) => fullName(e.participant)),
  };
}
