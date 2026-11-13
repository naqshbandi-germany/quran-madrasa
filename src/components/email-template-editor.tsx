"use client";

import { useActionState, useMemo, useRef, useState } from "react";

import { exampleValues, type EmailContent, type EmailTemplateKey } from "@/lib/email-defaults";
import { renderEmail } from "@/lib/email-render";
import { emailTemplateAction, type EmailTemplateResult } from "@/lib/email-template-actions";

type Field = keyof EmailContent;
type PlaceholderInfo = { key: string; label: string; html: boolean };

const INITIAL: EmailTemplateResult = { ok: false };
const INPUT = "mt-1 w-full border border-brand-300 bg-white px-3 py-2 text-sm";
const ERROR = "mt-1 text-sm text-red-700";

// Bearbeiten eines E-Mail-Textes: Felder links, Platzhalter rechts, darunter die Vorschau mit
// Beispielwerten. Die Vorschau nutzt dieselbe Funktion wie der echte Versand.
export function EmailTemplateEditor({
  templateKey,
  hasButton,
  placeholders,
  defaults,
  initial,
  isCustom,
}: {
  templateKey: EmailTemplateKey;
  hasButton: boolean;
  placeholders: PlaceholderInfo[];
  defaults: EmailContent;
  initial: EmailContent;
  isCustom: boolean;
}) {
  const [content, setContent] = useState<EmailContent>(initial);
  const [focused, setFocused] = useState<Field>("body");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const buttonRef = useRef<HTMLInputElement>(null);
  const footerRef = useRef<HTMLTextAreaElement>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: EmailTemplateResult, formData: FormData) => {
      const result = await emailTemplateAction(prev, formData);
      if (result.reset) setContent(defaults);
      return result;
    },
    INITIAL,
  );

  const preview = useMemo(
    () => renderEmail(templateKey, content, exampleValues(templateKey)),
    [templateKey, content],
  );
  const isDefault = (Object.keys(defaults) as Field[]).every((f) => content[f].trim() === defaults[f].trim());

  const set = (field: Field, value: string) => setContent((c) => ({ ...c, [field]: value }));

  // Platzhalter an der Cursor-Position des zuletzt benutzten Feldes einfuegen. HTML-Bloecke und
  // {{button}} gehoeren als eigener Absatz in den Text.
  function insert(placeholder: PlaceholderInfo) {
    const block = placeholder.html || placeholder.key === "button";
    const field: Field = block ? "body" : focused;
    const el = { subject: subjectRef, body: bodyRef, buttonLabel: buttonRef, footer: footerRef }[field].current;
    const value = content[field];
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const token = block ? `\n\n{{${placeholder.key}}}\n\n` : `{{${placeholder.key}}}`;
    const next = (value.slice(0, start) + token + value.slice(end)).replace(/\n{3,}/g, "\n\n");
    set(field, next);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = Math.min(start + token.length, next.length);
      el.setSelectionRange(pos, pos);
    });
  }

  const common = (field: Field) => ({
    name: field,
    value: content[field],
    onFocus: () => setFocused(field),
    "aria-invalid": Boolean(state.errors?.[field]) || undefined,
  });

  return (
    <div className="space-y-6">
      <form action={formAction} className="grid gap-6 border border-gold-400/40 bg-white p-5 lg:grid-cols-[1fr_16rem]">
        <input type="hidden" name="key" value={templateKey} />
        <div className="min-w-0 space-y-4">
          <p className="text-sm text-brand-700">
            {isCustom ? "Es gilt der hier gespeicherte, angepasste Text." : "Es gilt der Standardtext."}{" "}
            Absätze durch eine Leerzeile trennen, **fett** für Hervorhebungen.
          </p>
          <label className="block text-sm text-brand-700">
            Betreff
            <input ref={subjectRef} {...common("subject")} onChange={(e) => set("subject", e.target.value)} className={INPUT} />
            {state.errors?.subject && <p className={ERROR}>{state.errors.subject}</p>}
          </label>
          <label className="block text-sm text-brand-700">
            Text
            <textarea
              ref={bodyRef}
              {...common("body")}
              onChange={(e) => set("body", e.target.value)}
              rows={14}
              className={`${INPUT} font-mono`}
            />
            {state.errors?.body && <p className={ERROR}>{state.errors.body}</p>}
          </label>
          {hasButton && (
            <label className="block text-sm text-brand-700">
              Beschriftung des Buttons
              <input
                ref={buttonRef}
                {...common("buttonLabel")}
                onChange={(e) => set("buttonLabel", e.target.value)}
                className={INPUT}
              />
              {state.errors?.buttonLabel && <p className={ERROR}>{state.errors.buttonLabel}</p>}
            </label>
          )}
          <label className="block text-sm text-brand-700">
            Hinweis unten (kleine Schrift, optional)
            <textarea
              ref={footerRef}
              {...common("footer")}
              onChange={(e) => set("footer", e.target.value)}
              rows={3}
              className={INPUT}
            />
            {state.errors?.footer && <p className={ERROR}>{state.errors.footer}</p>}
          </label>

          {state.message && (
            <p
              role={state.ok ? "status" : "alert"}
              className={`px-3 py-2 text-sm ${state.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-900"}`}
            >
              {state.message}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button name="intent" value="save" disabled={pending} className="btn-primary px-4 py-2 disabled:opacity-60">
              {pending ? "Bitte warten …" : "Speichern"}
            </button>
            <button
              name="intent"
              value="test"
              disabled={pending}
              className="border border-brand-300 px-4 py-2 text-sm text-brand-900 hover:bg-brand-50 disabled:opacity-60"
            >
              Testmail an mich
            </button>
            <button
              name="intent"
              value="reset"
              disabled={pending || (!isCustom && isDefault)}
              onClick={(event) => {
                if (!window.confirm("Den Standardtext wiederherstellen? Der angepasste Text wird gelöscht.")) {
                  event.preventDefault();
                }
              }}
              className="text-sm text-brand-700 underline disabled:no-underline disabled:opacity-50"
            >
              Auf Standard zurücksetzen
            </button>
          </div>
        </div>

        <aside className="text-sm">
          <h2 className="font-semibold text-azure-800">Platzhalter</h2>
          <p className="mt-1 text-brand-600">Klicken fügt den Platzhalter an der Cursor-Position ein.</p>
          <ul className="mt-3 space-y-2">
            {placeholders.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => insert(p)}
                  className="bg-brand-50 px-1.5 py-0.5 font-mono text-xs text-brand-900 hover:bg-gold-400/20"
                >
                  {`{{${p.key}}}`}
                </button>
                <span className="mt-0.5 block text-brand-700">{p.label}</span>
              </li>
            ))}
          </ul>
        </aside>
      </form>

      <section className="border border-gold-400/40 bg-white p-5">
        <h2 className="font-semibold text-azure-800">Vorschau mit Beispielwerten</h2>
        <p className="mt-2 text-sm text-brand-700">
          <span className="text-brand-600">Betreff:</span> <strong>{preview.subject}</strong>
        </p>
        <iframe
          title="Vorschau der E-Mail"
          sandbox=""
          srcDoc={`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:16px;background:#fff">${preview.html}</body></html>`}
          className="mt-3 h-[28rem] w-full border border-brand-200"
        />
      </section>
    </div>
  );
}
