"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import type { ActionResult } from "@/lib/account-actions";
import { getAppUrl } from "@/lib/app-url";
import { getCourseCapacity } from "@/lib/course-capacity";
import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, deliverEmail } from "@/lib/resend";
import { getStripe } from "@/lib/stripe";
import { participantRemovedHtml, waitlistJoinedHtml, waitlistOfferHtml } from "@/lib/waitlist-email";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireTeacherOfCourse(courseId: string) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  const course = await prisma.course.findUniqueOrThrow({
    where: { id: courseId },
    include: { teacher: { select: { name: true, email: true } } },
  });
  if (session.user.role !== "ADMIN" && course.teacherId !== session.user.id) {
    throw new Error("Nicht berechtigt.");
  }
  return course;
}

function refreshCoursePages(courseId: string, slug: string) {
  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/courses/${slug}`);
  revalidatePath("/");
  revalidatePath("/quran");
}

// --- Oeffentlich: in die Warteliste eintragen -----------------------------------------------

const joinSchema = z.object({
  courseId: z.string().cuid(),
  name: z.string().trim().min(2, "Bitte gib deinen Namen ein.").max(80, "Der Name ist zu lang."),
  email: z.string().trim().toLowerCase().email("Bitte gib eine gültige E-Mail-Adresse ein.").max(200),
});

// Traegt einen Interessenten ohne Konto in die Warteliste eines vollen Kurses ein.
export async function joinWaitlist(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  // Honeypot: das Feld ist fuer Menschen unsichtbar, Bots fuellen es aus.
  if (text(formData, "website") !== "") return { ok: true, message: "Du stehst auf der Warteliste." };

  const parsed = joinSchema.safeParse({
    courseId: text(formData, "courseId"),
    name: text(formData, "name"),
    email: text(formData, "email"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { ok: false, errors };
  }
  if (text(formData, "consent") !== "on") {
    return { ok: false, errors: { consent: "Bitte stimme der Speicherung deiner Angaben zu." } };
  }

  const { courseId, name, email } = parsed.data;
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || !course.isPublished) return { ok: false, message: "Dieser Kurs ist nicht verfügbar." };

  const capacity = await getCourseCapacity(course.id, course.maxParticipants);
  if (!capacity.isFull) {
    return { ok: false, message: "Für diesen Kurs sind gerade Plätze frei. Du kannst dich direkt anmelden." };
  }

  const existing = await prisma.waitlistEntry.findUnique({ where: { courseId_email: { courseId, email } } });
  if (existing) return { ok: true, message: "Du stehst bereits auf der Warteliste für diesen Kurs." };

  try {
    await prisma.waitlistEntry.create({
      data: { courseId, name, email, consentAt: new Date() },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: true, message: "Du stehst bereits auf der Warteliste für diesen Kurs." };
    }
    throw err;
  }

  try {
    await deliverEmail({
      from: EMAIL_FROM,
      to: email,
      subject: `Warteliste: ${course.title}`,
      html: waitlistJoinedHtml({ name, courseTitle: course.title }),
    });
  } catch (err) {
    // Der Eintrag ist gespeichert; eine fehlgeschlagene Bestaetigung soll ihn nicht verwerfen.
    console.error("Warteliste: Bestätigungs-Mail fehlgeschlagen", err);
  }

  revalidatePath(`/teacher/courses/${courseId}`);
  return {
    ok: true,
    message: `Du stehst auf der Warteliste. Wir benachrichtigen dich unter ${email}, sobald ein Platz frei wird.`,
  };
}

// --- Lehrer: Teilnehmerbegrenzung ------------------------------------------------------------

export async function setMaxParticipants(formData: FormData) {
  const courseId = text(formData, "courseId");
  const course = await requireTeacherOfCourse(courseId);

  const raw = text(formData, "maxParticipants").trim();
  let max: number | null = null;
  if (raw !== "") {
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 500) {
      throw new Error("Die Teilnehmerzahl muss zwischen 1 und 500 liegen (oder leer für unbegrenzt).");
    }
    max = value;
  }

  await prisma.course.update({ where: { id: courseId }, data: { maxParticipants: max } });
  refreshCoursePages(courseId, course.slug);
}

// --- Lehrer: Teilnehmer austragen ------------------------------------------------------------

export type RemoveParticipantResult = {
  ok: boolean;
  message?: string;
  removedName?: string;
  courseTitle?: string;
  // Naechster Interessent auf der Warteliste (aeltester Eintrag), falls vorhanden.
  next?: { id: string; name: string; email: string; since: string; contacted: boolean } | null;
};

// Traegt einen Teilnehmer aus dem Kurs aus: Stripe-Abo verkleinern (bei der letzten Position
// beenden, ohne Rueckerstattung), Einschreibung loeschen, Konto-Inhaber benachrichtigen. Gibt
// den naechsten Wartenden zurueck, damit die Lehrkraft ihn direkt anschreiben kann.
export async function removeParticipantFromCourse(enrollmentId: string): Promise<RemoveParticipantResult> {
  const enrollment = await prisma.enrollment.findUnique({
    where: { id: enrollmentId },
    include: {
      participant: { select: { id: true, name: true } },
      user: { select: { name: true, email: true } },
      subscription: true,
      course: { select: { id: true, slug: true, title: true } },
    },
  });
  if (!enrollment) return { ok: false, message: "Diese Einschreibung gibt es nicht mehr." };
  const course = await requireTeacherOfCourse(enrollment.courseId);

  let subscriptionEnded = false;
  try {
    if (enrollment.subscription) {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(enrollment.subscription.stripeSubscriptionId);
      const item = sub.items.data[0];
      const remaining = (sub.metadata.participantIds ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id && id !== enrollment.participantId);
      const quantity = item?.quantity ?? 1;

      if (!item || quantity <= 1 || remaining.length === 0) {
        if (sub.status !== "canceled") await stripe.subscriptions.cancel(sub.id, { prorate: false });
        subscriptionEnded = true;
      } else {
        // Die Teilnehmer-IDs aus den Metadaten nehmen, sonst schreibt der Webhook ihn wieder ein.
        await stripe.subscriptions.update(sub.id, {
          items: [{ id: item.id, quantity: quantity - 1 }],
          metadata: { ...sub.metadata, participantIds: remaining.join(",") },
          proration_behavior: "none",
        });
        await prisma.subscription.update({
          where: { id: enrollment.subscription.id },
          data: { quantity: quantity - 1 },
        });
      }
    }
  } catch (err) {
    console.error("Teilnehmer austragen: Stripe-Fehler", err);
    return { ok: false, message: "Das Abo bei Stripe konnte nicht angepasst werden. Es wurde nichts geändert." };
  }

  await prisma.enrollment.delete({ where: { id: enrollmentId } });

  try {
    await deliverEmail({
      from: EMAIL_FROM,
      to: enrollment.user.email,
      subject: `Austragung aus dem Kurs ${enrollment.course.title}`,
      html: participantRemovedHtml({
        ownerName: enrollment.user.name,
        participantName: enrollment.participant.name,
        courseTitle: enrollment.course.title,
        subscriptionEnded,
      }),
      replyTo: course.teacher.email,
    });
  } catch (err) {
    console.error("Teilnehmer austragen: Mail fehlgeschlagen", err);
  }

  const next = await prisma.waitlistEntry.findFirst({
    where: { courseId: course.id },
    orderBy: { createdAt: "asc" },
  });

  refreshCoursePages(course.id, course.slug);
  return {
    ok: true,
    removedName: enrollment.participant.name,
    courseTitle: course.title,
    next: next
      ? {
          id: next.id,
          name: next.name,
          email: next.email,
          since: new Intl.DateTimeFormat("de-DE").format(next.createdAt),
          contacted: next.contactedAt != null,
        }
      : null,
  };
}

// --- Lehrer: Warteliste ----------------------------------------------------------------------

// Fragt einen Wartenden per E-Mail, ob das Interesse weiterhin besteht (Platz wird nicht reserviert).
export async function contactWaitlistEntry(entryId: string): Promise<ActionResult> {
  const entry = await prisma.waitlistEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { ok: false, message: "Der Eintrag existiert nicht mehr." };
  const course = await requireTeacherOfCourse(entry.courseId);

  try {
    await deliverEmail({
      from: EMAIL_FROM,
      to: entry.email,
      subject: `Platz frei: ${course.title}`,
      html: waitlistOfferHtml({
        name: entry.name,
        courseTitle: course.title,
        teacherName: course.teacher.name,
        enrollUrl: `${getAppUrl()}/courses/${course.slug}/anmelden`,
      }),
      replyTo: course.teacher.email,
    });
  } catch (err) {
    console.error("Warteliste: Anfrage-Mail fehlgeschlagen", err);
    return { ok: false, message: "Die E-Mail konnte nicht versendet werden." };
  }

  await prisma.waitlistEntry.update({ where: { id: entry.id }, data: { contactedAt: new Date() } });
  revalidatePath(`/teacher/courses/${course.id}`);
  return { ok: true, message: `${entry.name} wurde angeschrieben.` };
}

export async function removeWaitlistEntry(formData: FormData) {
  const entry = await prisma.waitlistEntry.findUnique({ where: { id: text(formData, "entryId") } });
  if (!entry) return;
  const course = await requireTeacherOfCourse(entry.courseId);
  await prisma.waitlistEntry.delete({ where: { id: entry.id } });
  refreshCoursePages(course.id, course.slug);
}
