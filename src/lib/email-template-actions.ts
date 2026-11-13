"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { exampleValues, isEmailTemplateKey, type EmailContent } from "@/lib/email-defaults";
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

// Speichern, auf Standard zuruecksetzen oder Testmail an den angemeldeten Admin schicken
// (mit Beispielwerten und dem Text aus dem Formular, auch wenn er noch nicht gespeichert ist).
export async function emailTemplateAction(
  _prev: EmailTemplateResult,
  formData: FormData,
): Promise<EmailTemplateResult> {
  const session = await auth();
  if (!session || session.user.role !== Role.ADMIN) throw new Error("Nicht berechtigt.");

  const key = text(formData, "key");
  if (!isEmailTemplateKey(key)) return { ok: false, message: "Diese E-Mail gibt es nicht." };
  const intent = text(formData, "intent");

  if (intent === "reset") {
    await prisma.emailTemplate.deleteMany({ where: { key } });
    revalidatePath("/admin/emails");
    revalidatePath(`/admin/emails/${key}`);
    return { ok: true, reset: true, message: "Der Standardtext gilt wieder." };
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

  await prisma.emailTemplate.upsert({
    where: { key },
    create: { key, ...content },
    update: content,
  });
  revalidatePath("/admin/emails");
  revalidatePath(`/admin/emails/${key}`);
  return { ok: true, message: "Gespeichert. Ab jetzt wird dieser Text verschickt." };
}
