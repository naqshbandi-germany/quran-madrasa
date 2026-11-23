"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { confirmEmailChange, requestEmailChange } from "@/lib/email-change";
import { PASSWORD_MAX_LENGTH, passwordMeetsRules } from "@/lib/password-rules";
import {
  validateParticipant,
  type ParticipantErrors,
  type ParticipantInput,
} from "@/lib/participant-rules";
import { prisma } from "@/lib/prisma";

// Ergebnis einer Formular-Aktion fuer die Anzeige am Formular (useActionState).
export type ActionResult = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

async function requireUserId() {
  const session = await auth();
  if (!session) throw new Error("Nicht angemeldet.");
  return session.user.id;
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// --- Profil ---------------------------------------------------------------------------

export async function updateProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const name = text(formData, "name").trim().replace(/\s+/g, " ");

  if (name.length < 2) return { ok: false, errors: { name: "Bitte gib deinen Namen ein." } };
  if (name.length > 80) return { ok: false, errors: { name: "Der Name ist zu lang." } };
  const muslimName = text(formData, "muslimName").trim().replace(/\s+/g, " ") || null;
  if (muslimName && muslimName.length > 80) return { ok: false, errors: { muslimName: "Der Name ist zu lang." } };

  const user = await prisma.user.update({ where: { id: userId }, data: { name, muslimName } });
  // Der Teilnehmer "Du selbst" folgt dem Namen des Kontos.
  await prisma.participant.updateMany({
    where: { ownerId: user.id, relation: "SELF" },
    data: { name, muslimName },
  });

  revalidatePath("/konto");
  return { ok: true, message: "Dein Name wurde gespeichert. In der Kopfzeile erscheint er nach der nächsten Anmeldung." };
}

// --- Passwort -------------------------------------------------------------------------

export async function changePassword(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const current = text(formData, "currentPassword");
  const next = text(formData, "newPassword");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!current || !(await bcrypt.compare(current, user.passwordHash))) {
    return { ok: false, errors: { currentPassword: "Das aktuelle Passwort stimmt nicht." } };
  }
  if (next.length > PASSWORD_MAX_LENGTH || !passwordMeetsRules(next)) {
    return { ok: false, errors: { newPassword: "Das neue Passwort erfüllt noch nicht alle Anforderungen." } };
  }
  if (next === current) {
    return { ok: false, errors: { newPassword: "Das neue Passwort muss sich vom alten unterscheiden." } };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(next, 10) },
  });
  // Offene Links zum Zuruecksetzen sind damit hinfaellig.
  await prisma.passwordResetToken.deleteMany({ where: { userId } });

  return { ok: true, message: "Dein Passwort wurde geändert." };
}

// --- E-Mail-Adresse -------------------------------------------------------------------

// Schritt 1: Passwort pruefen und einen Link an die neue Adresse schicken.
export async function changeEmail(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const email = text(formData, "newEmail").trim().toLowerCase();
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, errors: { newEmail: "Bitte gib eine gültige E-Mail-Adresse ein." } };
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const password = text(formData, "emailPassword");
  if (!password || password.length > PASSWORD_MAX_LENGTH || !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, errors: { emailPassword: "Das Passwort stimmt nicht." } };
  }
  if (email === user.email.toLowerCase()) {
    return { ok: false, errors: { newEmail: "Das ist bereits deine Adresse." } };
  }

  switch (await requestEmailChange(user, email)) {
    case "taken":
      return { ok: false, errors: { newEmail: "Mit dieser Adresse gibt es schon ein Konto." } };
    case "too-soon":
      return { ok: false, message: "Du hast gerade erst einen Link angefordert. Bitte warte eine Minute." };
    case "mail-failed":
      return { ok: false, message: "Die E-Mail konnte nicht verschickt werden. Bitte versuche es später noch einmal." };
    case "sent":
      return {
        ok: true,
        message: `Wir haben einen Link an ${email} geschickt. Bis du ihn bestätigst, gilt deine bisherige Adresse.`,
      };
  }
}

// Schritt 2: Link aus der E-Mail bestaetigen (auch ohne Anmeldung, der Link ist der Nachweis).
export async function confirmNewEmail(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  switch (await confirmEmailChange(text(formData, "token"))) {
    case "changed":
      return { ok: true, message: "Deine neue E-Mail-Adresse ist gespeichert. Melde dich ab jetzt damit an." };
    case "taken":
      return { ok: false, message: "Mit dieser Adresse gibt es inzwischen schon ein Konto." };
    case "invalid":
      return { ok: false, message: "Dieser Link ist ungültig, abgelaufen oder wurde schon benutzt." };
  }
}

// --- Teilnehmer -----------------------------------------------------------------------

export async function updateParticipant(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = text(formData, "participantId");

  const participant = await prisma.participant.findFirst({ where: { id, ownerId: userId } });
  if (!participant) return { ok: false, message: "Teilnehmer nicht gefunden." };

  const isSelf = participant.relation === "SELF";
  const input: ParticipantInput = {
    relation: participant.relation,
    // "Du selbst" folgt dem Konto: Name und E-Mail sind dort festgelegt.
    name: isSelf ? participant.name : text(formData, "name"),
    muslimName: isSelf ? (participant.muslimName ?? "") : text(formData, "muslimName"),
    email: isSelf ? (participant.email ?? "") : text(formData, "email"),
    birthYear: participant.relation === "CHILD" ? text(formData, "birthYear") : "",
    whatsapp: text(formData, "whatsapp"),
    whatsappConsent: formData.get("whatsappConsent") === "on",
    // Die urspruengliche Bestaetigung (Sorgeberechtigung, Erwachsene Person) bleibt bestehen.
    consentConfirmed: participant.relation === "SELF" || participant.consentConfirmedAt !== null,
  };

  const { errors, clean } = validateParticipant(input);
  if (!clean) {
    return { ok: false, errors: errors as ParticipantErrors as Record<string, string> };
  }

  const numberChanged = clean.whatsapp !== participant.whatsapp;
  let whatsappConsentAt = participant.whatsappConsentAt;
  if (!clean.whatsapp) whatsappConsentAt = null;
  else if (numberChanged || !participant.whatsappConsentAt) whatsappConsentAt = new Date();

  await prisma.participant.update({
    where: { id },
    data: {
      name: clean.name,
      muslimName: clean.muslimName,
      email: clean.email,
      birthYear: clean.birthYear,
      whatsapp: clean.whatsapp,
      whatsappConsentAt,
    },
  });

  revalidatePath("/konto");
  revalidatePath("/dashboard");
  return { ok: true, message: "Gespeichert." };
}

export async function deleteParticipant(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const id = text(formData, "participantId");

  const participant = await prisma.participant.findFirst({
    where: { id, ownerId: userId },
    include: { enrollments: { select: { id: true } } },
  });
  if (!participant) return { ok: false, message: "Teilnehmer nicht gefunden." };

  if (participant.enrollments.length > 0) {
    return {
      ok: false,
      message:
        "Dieser Teilnehmer ist noch in einem Kurs angemeldet. Beende zuerst das Abo unter „Abo verwalten“.",
    };
  }

  await prisma.participant.delete({ where: { id } });
  revalidatePath("/konto");
  return { ok: true, message: "Teilnehmer gelöscht." };
}
