"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
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

  const user = await prisma.user.update({ where: { id: userId }, data: { name } });
  // Der Teilnehmer "Du selbst" folgt dem Namen des Kontos.
  await prisma.participant.updateMany({
    where: { ownerId: user.id, relation: "SELF" },
    data: { name },
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
