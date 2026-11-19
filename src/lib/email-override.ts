import { isTeacherEmailKey, type EmailContent, type TeacherEmailKey } from "@/lib/email-defaults";
import { validateEmailContent } from "@/lib/email-render";
import type { EmailContentOptions } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

// Liest den in der Vorschau (Komponente EmailPreview) angepassten Text aus dem Formular. Felder:
// mail_key, mail_edited ("1", wenn geaendert), mail_subject, mail_body, mail_buttonLabel,
// mail_footer und mail_save ("on" = als eigene Vorlage speichern).
// Ergebnis: Optionen fuer loadEmailContent oder eine Fehlermeldung.
export async function emailOptionsFromForm(
  formData: FormData,
  key: TeacherEmailKey,
  userId: string,
): Promise<{ ok: true; options: EmailContentOptions } | { ok: false; message: string }> {
  const base: EmailContentOptions = { senderId: userId };
  const formKey = formData.get("mail_key");
  if (formData.get("mail_edited") !== "1" || formKey !== key || !isTeacherEmailKey(formKey)) {
    return { ok: true, options: base };
  }

  const field = (name: string) => {
    const value = formData.get(`mail_${name}`);
    return typeof value === "string" ? value.replace(/\r\n/g, "\n").trim() : "";
  };
  const content: EmailContent = {
    subject: field("subject"),
    body: field("body"),
    buttonLabel: field("buttonLabel"),
    footer: field("footer"),
  };
  const errors = validateEmailContent(key, content);
  const first = Object.values(errors)[0];
  if (first) return { ok: false, message: `Text der E-Mail: ${first}` };

  if (formData.get("mail_save") === "on") {
    await prisma.teacherEmailTemplate.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, ...content },
      update: content,
    });
  }
  return { ok: true, options: { ...base, override: content } };
}
