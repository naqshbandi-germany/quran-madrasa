"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import {
  EMAIL_TEMPLATES,
  exampleValues,
  withRequiredBlocks,
  type EmailContent,
  type TeacherEmailKey,
} from "@/lib/email-defaults";
import { renderEmail, validateEmailContent } from "@/lib/email-render";
import type { EditableEmail } from "@/lib/email-templates";

type Field = keyof EmailContent;

const INPUT = "mt-1 w-full border border-brand-300 bg-white px-3 py-2 text-sm";

function same(a: EmailContent, b: EmailContent) {
  return (Object.keys(a) as Field[]).every((f) => a[f].trim() === b[f].trim());
}

// Vorschau einer Mail vor dem Versand, so wie sie beim Empfaenger ankommt, mit der Moeglichkeit,
// den Text nur fuer diesen Versand zu aendern oder als eigene Vorlage zu speichern. Steht
// innerhalb des Formulars, das die Mail ausloest, und liefert die Felder mail_* (ausgewertet mit
// emailOptionsFromForm). values: echte Angaben fuer die Vorschau (z. B. Name des ersten
// Empfaengers); fehlende Platzhalter zeigen Beispielwerte.
export function EmailPreview({
  templateKey,
  editable,
  values,
  recipientLabel,
  defaultOpen = false,
}: {
  templateKey: TeacherEmailKey;
  editable: EditableEmail;
  values: Record<string, string>;
  // z. B. "Fatima" oder "Fatima und 4 weitere"
  recipientLabel?: string;
  defaultOpen?: boolean;
}) {
  const definition = EMAIL_TEMPLATES[templateKey];
  const [open, setOpen] = useState(defaultOpen);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState<EmailContent>(editable.content);
  const [save, setSave] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const edited = !same(content, editable.content);
  const errors = edited ? validateEmailContent(templateKey, content) : {};
  const preview = useMemo(
    () =>
      renderEmail(templateKey, withRequiredBlocks(templateKey, content), {
        ...exampleValues(templateKey),
        ...Object.fromEntries(Object.entries(values).filter(([, v]) => v !== undefined)),
      }),
    [templateKey, content, values],
  );

  const set = (field: Field, value: string) => setContent((c) => ({ ...c, [field]: value }));

  function insert(key: string, block: boolean) {
    const el = bodyRef.current;
    const value = content.body;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const token = block ? `\n\n{{${key}}}\n\n` : `{{${key}}}`;
    const next = (value.slice(0, start) + token + value.slice(end)).replace(/\n{3,}/g, "\n\n");
    set("body", next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = Math.min(start + token.length, next.length);
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="space-y-3 border border-brand-200 bg-white p-3">
      <input type="hidden" name="mail_key" value={templateKey} />
      {edited && (
        <>
          <input type="hidden" name="mail_edited" value="1" />
          <input type="hidden" name="mail_subject" value={content.subject} />
          <input type="hidden" name="mail_body" value={content.body} />
          <input type="hidden" name="mail_buttonLabel" value={content.buttonLabel} />
          <input type="hidden" name="mail_footer" value={content.footer} />
          {save && <input type="hidden" name="mail_save" value="on" />}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-brand-900">
          E-Mail: {definition.label}
          <span className="font-normal text-brand-600">
            {" "}
            · {edited ? "für diesen Versand geändert" : editable.isOwn ? "deine eigene Vorlage" : "allgemeiner Text"}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="text-sm font-medium text-azure-800 underline"
        >
          {open ? "Vorschau ausblenden" : "Vorschau ansehen und Text anpassen"}
        </button>
      </div>

      {open && (
        <div className="space-y-3">
          <p className="text-sm text-brand-700">
            <span className="text-brand-600">
              So sieht es {recipientLabel ?? (values.name ? `bei ${values.name}` : "beim Empfänger")} ungefähr aus:
            </span>{" "}
            Betreff <strong>{preview.subject}</strong>
          </p>
          <iframe
            title="Vorschau der E-Mail"
            sandbox=""
            srcDoc={`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff">${preview.html}</body></html>`}
            className="h-[24rem] w-full border border-brand-200"
          />
          <p className="text-xs text-brand-600">
            {definition.placeholders.some((p) => p.key === "link")
              ? "Links in der Vorschau sind Beispiele; jeder Empfänger bekommt seinen eigenen Link und seinen Namen."
              : "Jeder Empfänger bekommt die Mail mit seinem eigenen Namen."}
          </p>

          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="border border-brand-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-900 hover:bg-brand-50"
            >
              Text anpassen
            </button>
          ) : (
            <div className="space-y-3 border-t border-brand-100 pt-3">
              <p className="text-xs text-brand-600">
                Absätze durch eine Leerzeile trennen, **fett** für Hervorhebungen. Platzhalter wie {"{{name}}"} werden
                für jeden Empfänger ersetzt.
              </p>
              <label className="block text-sm text-brand-700">
                Betreff
                <input value={content.subject} onChange={(e) => set("subject", e.target.value)} className={INPUT} />
                {errors.subject && <span className="mt-1 block text-red-700">{errors.subject}</span>}
              </label>
              <label className="block text-sm text-brand-700">
                Text
                <textarea
                  ref={bodyRef}
                  value={content.body}
                  onChange={(e) => set("body", e.target.value)}
                  rows={10}
                  className={`${INPUT} font-mono`}
                />
                {errors.body && <span className="mt-1 block text-red-700">{errors.body}</span>}
              </label>
              <div className="flex flex-wrap gap-1.5" aria-label="Platzhalter einfügen">
                {definition.placeholders.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    title={p.label}
                    onClick={() => insert(p.key, ("html" in p && p.html) || p.key === "button")}
                    className="bg-brand-50 px-1.5 py-0.5 font-mono text-xs text-brand-900 hover:bg-gold-400/20"
                  >
                    {`{{${p.key}}}`}
                  </button>
                ))}
              </div>
              {definition.hasButton && (
                <label className="block text-sm text-brand-700">
                  Beschriftung des Buttons
                  <input
                    value={content.buttonLabel}
                    onChange={(e) => set("buttonLabel", e.target.value)}
                    className={INPUT}
                  />
                  {errors.buttonLabel && <span className="mt-1 block text-red-700">{errors.buttonLabel}</span>}
                </label>
              )}
              <label className="block text-sm text-brand-700">
                Hinweis unten (kleine Schrift, optional)
                <textarea value={content.footer} onChange={(e) => set("footer", e.target.value)} rows={2} className={INPUT} />
                {errors.footer && <span className="mt-1 block text-red-700">{errors.footer}</span>}
              </label>

              <label className="flex items-start gap-2 text-sm text-brand-800">
                <input
                  type="checkbox"
                  checked={save}
                  disabled={!edited}
                  onChange={(e) => setSave(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  Als meine Vorlage speichern (gilt dann auch für künftige Mails dieser Art; ändern kannst du sie unter{" "}
                  <Link href={`/teacher/mailvorlagen/${templateKey}`} className="underline" target="_blank">
                    Mailvorlagen
                  </Link>
                  )
                </span>
              </label>
              <div className="flex flex-wrap gap-3 text-sm">
                {edited && (
                  <button
                    type="button"
                    onClick={() => {
                      setContent(editable.content);
                      setSave(false);
                    }}
                    className="text-brand-700 underline"
                  >
                    Änderungen verwerfen
                  </button>
                )}
                {(editable.isOwn || edited) && !same(content, editable.standard) && (
                  <button type="button" onClick={() => setContent(editable.standard)} className="text-brand-700 underline">
                    Allgemeinen Text einsetzen
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
