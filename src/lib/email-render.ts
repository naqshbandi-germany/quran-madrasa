import { getTemplateDefinition, type EmailContent, type EmailTemplateKey } from "@/lib/email-defaults";
import { escapeHtml } from "@/lib/html";

// Setzt aus einem (gespeicherten oder Standard-)Text und den Werten einer Mail Betreff und
// HTML zusammen. Wird beim Versand und fuer die Vorschau im Admin-Bereich verwendet und
// darf deshalb nichts Serverseitiges importieren.
//
// Sicherheit: Sowohl der Text des Admins als auch alle Platzhalterwerte werden maskiert. Nur
// Platzhalter, die als html markiert sind (vom Code erzeugte Listen), werden roh eingesetzt.

const PLACEHOLDER = /\{\{\s*([a-z_]+)\s*\}\}/g;

const has = (values: Record<string, string>, name: string) =>
  Object.prototype.hasOwnProperty.call(values, name);

const COLORS ={ text: "#1d2a24", title: "#14325c", button: "#1d6347", muted: "#5b6470" };

function htmlKeys(key: EmailTemplateKey) {
  return new Set(getTemplateDefinition(key).placeholders.filter((p) => p.html).map((p) => p.key));
}

// Eine Zeile bzw. ein Absatz: maskieren, **fett** umsetzen, dann Platzhalter einsetzen und
// Zeilenumbrueche als <br> ausgeben. Werte werden erst nach dem Fettdruck eingesetzt, damit
// "**" in einem Namen nichts veraendert.
function renderInline(text: string, values: Record<string, string>, raw: Set<string>) {
  return escapeHtml(text)
    .replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>")
    .replace(PLACEHOLDER, (match, name: string) => {
      if (!has(values, name)) return match;
      return raw.has(name) ? values[name] : escapeHtml(values[name]);
    })
    .replace(/\r?\n/g, "<br />");
}

function buttonHtml(label: string, href: string) {
  return `<p style="margin: 24px 0;"><a href="${escapeHtml(href)}" style="background: ${COLORS.button}; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">${label}</a></p>`;
}

export function renderEmail(
  key: EmailTemplateKey,
  content: EmailContent,
  values: Record<string, string>,
): { subject: string; html: string } {
  const definition = getTemplateDefinition(key);
  const raw = htmlKeys(key);

  const subject = content.subject
    .replace(PLACEHOLDER, (match, name: string) => (has(values, name) && !raw.has(name) ? values[name] : match))
    .replace(/\s+/g, " ")
    .trim();

  const button =
    definition.hasButton && content.buttonLabel.trim() && values.link
      ? buttonHtml(renderInline(content.buttonLabel.trim(), values, new Set()), values.link)
      : "";

  let buttonPlaced = false;
  const paragraphs = content.body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const only = /^\{\{\s*([a-z_]+)\s*\}\}$/.exec(paragraph)?.[1];
      if (only === "button") {
        buttonPlaced = true;
        return button;
      }
      // Ein HTML-Block (z. B. Terminliste) allein im Absatz kommt ohne <p> aus.
      if (only && raw.has(only)) return values[only] ?? "";
      return `<p>${renderInline(paragraph, values, raw)}</p>`;
    });
  if (!buttonPlaced && button) paragraphs.push(button);

  const footer = content.footer.trim()
    ? `<p style="font-size: 13px; color: ${COLORS.muted};">${renderInline(content.footer.trim(), values, new Set())}</p>`
    : "";

  const html = `
    <div style="font-family: sans-serif; color: ${COLORS.text}; max-width: 480px; margin: 0 auto; line-height: 1.5;">
      <h1 style="color: ${COLORS.title}; font-size: 20px;">Quran Madrasa</h1>
      ${paragraphs.filter(Boolean).join("\n      ")}
      ${footer}
    </div>`;

  return { subject, html };
}

export type EmailValidation = Partial<Record<keyof EmailContent, string>>;

// Prueft einen Text vor dem Speichern: Pflichtfelder, Laenge und nur bekannte Platzhalter.
export function validateEmailContent(key: EmailTemplateKey, content: EmailContent): EmailValidation {
  const definition = getTemplateDefinition(key);
  const known = new Set<string>(definition.placeholders.map((p) => p.key));
  const errors: EmailValidation = {};

  const unknownIn = (text: string, allowed: Set<string>) =>
    [...text.matchAll(PLACEHOLDER)].map((m) => m[1]).filter((name) => !allowed.has(name));
  const describe = (names: string[]) =>
    `Unbekannter Platzhalter: ${[...new Set(names)].map((n) => `{{${n}}}`).join(", ")}.`;
  const inline = new Set([...known].filter((k) => k !== "button" && !htmlKeys(key).has(k)));

  if (!content.subject.trim()) errors.subject = "Bitte gib einen Betreff an.";
  else if (content.subject.length > 200) errors.subject = "Der Betreff ist zu lang (höchstens 200 Zeichen).";
  else if (unknownIn(content.subject, inline).length) errors.subject = describe(unknownIn(content.subject, inline));

  if (!content.body.trim()) errors.body = "Bitte gib einen Text an.";
  else if (content.body.length > 10000) errors.body = "Der Text ist zu lang (höchstens 10.000 Zeichen).";
  else if (unknownIn(content.body, known).length) errors.body = describe(unknownIn(content.body, known));

  if (definition.hasButton) {
    if (!content.buttonLabel.trim()) errors.buttonLabel = "Diese Mail braucht eine Button-Beschriftung.";
    else if (content.buttonLabel.length > 80) errors.buttonLabel = "Die Beschriftung ist zu lang.";
    else if (unknownIn(content.buttonLabel, inline).length) errors.buttonLabel = describe(unknownIn(content.buttonLabel, inline));
  }

  if (content.footer.length > 1000) errors.footer = "Der Hinweis ist zu lang.";
  else if (unknownIn(content.footer, inline).length) errors.footer = describe(unknownIn(content.footer, inline));

  return errors;
}

// Textfassung einer HTML-Mail fuer die Konsole bei lokaler Entwicklung.
export function htmlToText(html: string) {
  return html
    .replace(/<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, "[$2]($1)")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/(p|h1|li|ul|div)>/g, "\n")
    .replace(/<li>/g, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
