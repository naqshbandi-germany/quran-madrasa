import {
  EMAIL_TEMPLATES,
  type EmailContent,
  type EmailTemplateKey,
  type EmailValues,
} from "@/lib/email-defaults";
import { renderEmail } from "@/lib/email-render";
import { prisma } from "@/lib/prisma";

// Liefert den im Admin-Bereich gespeicherten Text einer Mail oder, falls keiner gespeichert
// ist, den Standardtext. Kann die Datenbank nicht gelesen werden, geht die Mail mit dem
// Standardtext raus, statt gar nicht.
export async function loadEmailContent(key: EmailTemplateKey): Promise<EmailContent> {
  try {
    const stored = await prisma.emailTemplate.findUnique({ where: { key } });
    if (stored) {
      return {
        subject: stored.subject,
        body: stored.body,
        buttonLabel: stored.buttonLabel,
        footer: stored.footer,
      };
    }
  } catch (err) {
    console.error(`E-Mail-Text "${key}" konnte nicht geladen werden, Standardtext wird verwendet:`, err);
  }
  return { ...EMAIL_TEMPLATES[key].defaults };
}

// Fuer Schleifen (viele Empfaenger): Text einmal laden, dann pro Empfaenger rendern.
export async function emailRenderer<K extends EmailTemplateKey>(key: K) {
  const content = await loadEmailContent(key);
  return (values: EmailValues<K>) => renderEmail(key, content, values);
}

export async function buildEmail<K extends EmailTemplateKey>(key: K, values: EmailValues<K>) {
  return renderEmail(key, await loadEmailContent(key), values);
}
