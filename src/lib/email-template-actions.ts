"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { exampleValues, isEmailTemplateKey, isTeacherEmailKey, type EmailContent } from "@/lib/email-defaults";
import { renderEmail, validateEmailContent } from "@/lib/email-render";
import { prisma } from "@/lib/prisma";
import { EMAIL_FROM, deliverEmail } from "@/lib/resend";

export type EmailTemplateResult = {
  ok: boolean;
  message?: string;
  errors?: Partial<Record<keyof EmailContent, string>>;
  // Nach dem Zuruecksetzen: ob jetzt der Standardtext gilt (Editor uebernimmt ihn dann).
  reset?: boolean;
};

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.replace(/\r\n/g, "\n") : "";
}

// Speichern, auf Standard zuruecksetzen oder Testmail an den angemeldeten Nutzer schicken
// (mit Beispielwerten und dem Text aus dem Formular, auch wenn er noch nicht gespeichert ist).
// scope "admin": Text fuer alle (nur Admins). scope "teacher": eigene Vorlage der angemeldeten
// Lehrkraft (bzw. des Admins) fuer die Mails, die sie selbst ausloest.
export async function emailTemplateAction(
  _prev: EmailTemplateResult,
  formData: FormData,
): Promise<EmailTemplateResult> {
  const session = await auth();
  const teacherScope = text(formData, "scope") === "teacher";
  const allowed = teacherScope
    ? session?.user.role === Role.TEACHER || session?.user.role === Role.ADMIN
    : session?.user.role === Role.ADMIN;
  if (!session || !allowed) throw new Error("Nicht berechtigt.");
  const userId = session.user.id;

  const key = text(formData, "key");
  if (!isEmailTemplateKey(key) || (teacherScope && !isTeacherEmailKey(key))) {
    return { ok: false, message: "Diese E-Mail gibt es nicht." };
  }
  const intent = text(formData, "intent");
  const refresh = () => {
    if (teacherScope) {
      revalidatePath("/teacher/mailvorlagen");
      revalidatePath(`/teacher/mailvorlagen/${key}`);
    } else {
      revalidatePath("/admin/emails");
      revalidatePath(`/admin/emails/${key}`);
    }
  };

  if (intent === "reset") {
    if (teacherScope) await prisma.teacherEmailTemplate.deleteMany({ where: { userId, key } });
    else await prisma.emailTemplate.deleteMany({ where: { key } });
    refresh();
    return { ok: true, reset: true, message: teacherScope ? "Der allgemeine Text gilt wieder." : "Der Standardtext gilt wieder." };
  }

  const content: EmailContent = {
    subject: text(formData, "subject").trim(),
    body: text(formData, "body").trim(),
    buttonLabel: text(formData, "buttonLabel").trim(),
    footer: text(formData, "footer").trim(),
  };
  const errors = validateEmailContent(key, content);
  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Bitte prüfe die markierten Felder.", errors };
  }

  if (intent === "test") {
    const to = session.user.email;
    if (!to) return { ok: false, message: "Für dein Konto ist keine E-Mail-Adresse hinterlegt." };
    const { subject, html } = renderEmail(key, content, exampleValues(key));
    try {
      await deliverEmail({ from: EMAIL_FROM, to, subject: `[Test] ${subject}`, html });
    } catch (err) {
      console.error("Testmail fehlgeschlagen:", err);
      return { ok: false, message: "Die Testmail konnte nicht verschickt werden." };
    }
    return { ok: true, message: `Testmail mit Beispielwerten an ${to} verschickt.` };
  }

  if (teacherScope) {
    await prisma.teacherEmailTemplate.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, ...content },
      update: content,
    });
  } else {
    await prisma.emailTemplate.upsert({
      where: { key },
      create: { key, ...content },
      update: content,
    });
  }
  refresh();
  return {
    ok: true,
    message: teacherScope
      ? "Gespeichert. Ab jetzt wird dieser Text für deine Mails verwendet."
      : "Gespeichert. Ab jetzt wird dieser Text verschickt.",
  };
}
