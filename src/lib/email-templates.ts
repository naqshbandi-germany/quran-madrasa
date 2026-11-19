import {
  EMAIL_TEMPLATES,
  withRequiredBlocks,
  type EmailContent,
  type EmailTemplateKey,
  type EmailValues,
} from "@/lib/email-defaults";
import { renderEmail } from "@/lib/email-render";
import { prisma } from "@/lib/prisma";

// Welcher Text gilt? Der Reihe nach: ein fuer diesen Versand angepasster Text (override), die
// eigene Vorlage der ausloesenden Lehrkraft (senderId), der im Admin-Bereich gespeicherte Text,
// der Standardtext.
export type EmailContentOptions = {
  senderId?: string | null;
  override?: EmailContent | null;
};

function fromRow(row: { subject: string; body: string; buttonLabel: string; footer: string }): EmailContent {
  return { subject: row.subject, body: row.body, buttonLabel: row.buttonLabel, footer: row.footer };
}

// Text ohne eigene Vorlage der Lehrkraft: im Admin-Bereich gespeichert oder Standard. Kann die
// Datenbank nicht gelesen werden, geht die Mail mit dem Standardtext raus, statt gar nicht.
export async function loadStandardEmailContent(key: EmailTemplateKey): Promise<EmailContent> {
  try {
    const stored = await prisma.emailTemplate.findUnique({ where: { key } });
    if (stored) return fromRow(stored);
  } catch (err) {
    console.error(`E-Mail-Text "${key}" konnte nicht geladen werden, Standardtext wird verwendet:`, err);
  }
  return { ...EMAIL_TEMPLATES[key].defaults };
}

export async function loadTeacherEmailContent(key: EmailTemplateKey, userId: string): Promise<EmailContent | null> {
  try {
    const own = await prisma.teacherEmailTemplate.findUnique({ where: { userId_key: { userId, key } } });
    return own ? fromRow(own) : null;
  } catch (err) {
    console.error(`Eigene Vorlage "${key}" konnte nicht geladen werden:`, err);
    return null;
  }
}

export async function loadEmailContent(key: EmailTemplateKey, options: EmailContentOptions = {}): Promise<EmailContent> {
  const content =
    options.override ??
    (options.senderId ? await loadTeacherEmailContent(key, options.senderId) : null) ??
    (await loadStandardEmailContent(key));
  return withRequiredBlocks(key, content);
}

// Fuer Schleifen (viele Empfaenger): Text einmal laden, dann pro Empfaenger rendern.
export async function emailRenderer<K extends EmailTemplateKey>(key: K, options?: EmailContentOptions) {
  const content = await loadEmailContent(key, options);
  return (values: EmailValues<K>) => renderEmail(key, content, values);
}

export async function buildEmail<K extends EmailTemplateKey>(key: K, values: EmailValues<K>, options?: EmailContentOptions) {
  return renderEmail(key, await loadEmailContent(key, options), values);
}

// Fuer die Vorschau vor dem Versand: der Text, der gerade gilt, der Text ohne eigene Vorlage
// (zum Zuruecksetzen) und ob eine eigene Vorlage gespeichert ist.
export type EditableEmail = { content: EmailContent; standard: EmailContent; isOwn: boolean };

export async function editableEmail(key: EmailTemplateKey, userId: string): Promise<EditableEmail> {
  const [own, standard] = await Promise.all([loadTeacherEmailContent(key, userId), loadStandardEmailContent(key)]);
  return { content: own ?? standard, standard, isOwn: Boolean(own) };
}
