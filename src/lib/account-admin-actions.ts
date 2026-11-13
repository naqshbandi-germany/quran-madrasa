"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { deleteSampleAudio } from "@/lib/reading-samples";
import { getStripe } from "@/lib/stripe";
import { retrieveSubscriptionIfPresent } from "@/lib/stripe-subscription";

export type DeleteAccountResult = { message?: string };

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

// Loescht ein Schueler- oder Lehrer-Konto vollstaendig. Sicherheitsabfrage: Die E-Mail-Adresse des
// Kontos muss exakt eingetippt werden. Admin-Konten und das eigene Konto sind ausgenommen.
//
// Lehrer: Jeder Kurs muss vorher einer anderen Lehrkraft zugeordnet werden (Feld "course_<id>");
// Termine, Teilnehmer, Anwesenheit und Leseproben haengen am Kurs und ziehen mit um. Die Mediathek
// geht an die Lehrkraft aus "mediaTo", sonst wuerde sie mitgeloescht.
//
// Fuer alle: laufende Stripe-Abos kuendigen (ohne Rueckerstattung), Leseproben-Audios entfernen,
// dann Konto mit Teilnehmern, Anmeldungen, Abo-Datensaetzen, Auswertungen, Leseproben und
// Wartelisten-Eintraegen loeschen. Zahlungsbelege bleiben bei Stripe (Aufbewahrungspflicht).
export async function deleteAccount(_prev: DeleteAccountResult, formData: FormData): Promise<DeleteAccountResult> {
  const session = await auth();
  if (!session || session.user.role !== Role.ADMIN) throw new Error("Nicht berechtigt.");

  const user = await prisma.user.findUnique({
    where: { id: text(formData, "userId") },
    include: {
      subscriptions: { select: { stripeSubscriptionId: true, status: true } },
      participants: { select: { readingSamples: { select: { blobPathname: true } } } },
      taughtCourses: { select: { id: true } },
      _count: { select: { mediaFiles: true } },
    },
  });
  if (!user) return { message: "Dieses Konto gibt es nicht mehr." };
  if (user.id === session.user.id) return { message: "Das eigene Konto lässt sich hier nicht löschen." };
  if (user.role === Role.ADMIN) return { message: "Admin-Konten lassen sich hier nicht löschen." };
  if (text(formData, "confirmEmail").toLowerCase() !== user.email.toLowerCase()) {
    return { message: "Die eingetippte E-Mail-Adresse stimmt nicht. Es wurde nichts gelöscht." };
  }

  // Neue Lehrkraft pro Kurs und fuer die Mediathek: muss eine andere, bestehende Lehrkraft sein.
  const courseTargets = user.taughtCourses.map((course) => ({
    courseId: course.id,
    teacherId: text(formData, `course_${course.id}`),
  }));
  const mediaTo = user._count.mediaFiles > 0 ? text(formData, "mediaTo") : "";
  const wanted = [...new Set([...courseTargets.map((t) => t.teacherId), ...(mediaTo ? [mediaTo] : [])])];
  if (courseTargets.some((t) => !t.teacherId)) {
    return { message: "Bitte jedem Kurs eine neue Lehrkraft zuordnen. Es wurde nichts gelöscht." };
  }
  if (user._count.mediaFiles > 0 && !mediaTo) {
    return { message: "Bitte wählen, wer die Mediathek übernimmt. Es wurde nichts gelöscht." };
  }
  const validTeachers = await prisma.user.count({
    where: { id: { in: wanted.filter((id) => id !== user.id) }, role: Role.TEACHER },
  });
  if (validTeachers !== wanted.length) {
    return { message: "Die gewählte Lehrkraft gibt es nicht (mehr). Es wurde nichts gelöscht." };
  }

  // Zuerst die Abos bei Stripe beenden. Klappt das nicht, bleibt alles unveraendert.
  const otherAccountSubscriptions: string[] = [];
  try {
    for (const local of user.subscriptions) {
      if (local.status === "CANCELED") continue;
      const sub = await retrieveSubscriptionIfPresent(local.stripeSubscriptionId);
      if (!sub) {
        otherAccountSubscriptions.push(local.stripeSubscriptionId);
      } else if (sub.status !== "canceled") {
        await getStripe().subscriptions.cancel(sub.id, { prorate: false });
      }
    }
  } catch (err) {
    console.error("Konto loeschen: Stripe-Fehler", err);
    return { message: "Ein Abo konnte bei Stripe nicht gekündigt werden. Es wurde nichts gelöscht." };
  }

  for (const participant of user.participants) {
    for (const sample of participant.readingSamples) await deleteSampleAudio(sample);
  }

  await prisma.$transaction([
    ...courseTargets.map((t) =>
      prisma.course.update({ where: { id: t.courseId }, data: { teacherId: t.teacherId } }),
    ),
    ...(mediaTo ? [prisma.mediaFile.updateMany({ where: { ownerId: user.id }, data: { ownerId: mediaTo } })] : []),
    // Anmeldungen haengen am Konto und am Teilnehmer (ohne Cascade), daher zuerst.
    prisma.enrollment.deleteMany({
      where: { OR: [{ userId: user.id }, { participant: { ownerId: user.id } }] },
    }),
    prisma.subscription.deleteMany({ where: { userId: user.id } }),
    prisma.waitlistEntry.deleteMany({ where: { email: { equals: user.email, mode: "insensitive" } } }),
    // Cascade: Teilnehmer (mit Auswertungen und Leseproben) und Passwort-Links.
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  // Freie Plaetze und Lehrer-Angaben aendern sich. Danach zur Kontenliste: Die Seite des
  // geloeschten Kontos gibt es nicht mehr. Abos aus einem frueheren Stripe-Konto (dort von Hand
  // kuendigen, sonst wird weiter abgebucht) werden dort angezeigt; die Abo-IDs enthalten keine
  // personenbezogenen Daten.
  revalidatePath("/courses/[slug]", "page");
  revalidatePath("/teacher/courses/[id]", "page");
  revalidatePath("/");
  revalidatePath("/quran");
  revalidatePath("/lehrer");
  revalidatePath("/admin");
  const params = new URLSearchParams({ geloescht: "1" });
  if (otherAccountSubscriptions.length > 0) params.set("alteAbos", otherAccountSubscriptions.join(","));
  redirect(`/admin/konten?${params}`);
}
