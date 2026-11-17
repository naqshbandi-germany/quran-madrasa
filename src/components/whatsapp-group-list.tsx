"use client";

import { useOptimistic, useTransition } from "react";

import { CopyButton } from "@/components/copy-button";
import { setWhatsappAdded } from "@/lib/course-manage-actions";

export type WhatsappMember = {
  // Nummer im internationalen Format; Geschwister mit derselben Nummer stehen in einer Zeile.
  whatsapp: string;
  names: string;
  added: boolean;
};

// Teilnehmer mit WhatsApp-Nummer. Per Haekchen markiert die Lehrkraft, wen sie schon in die
// Kurs-Gruppe aufgenommen hat (gruen); wer noch fehlt, erscheint rot mit "(neu)".
export function WhatsappGroupList({ courseId, members }: { courseId: string; members: WhatsappMember[] }) {
  const [optimistic, setOptimistic] = useOptimistic(
    members,
    (current, change: { whatsapp: string; added: boolean }) =>
      current.map((m) => (m.whatsapp === change.whatsapp ? { ...m, added: change.added } : m)),
  );
  const [, startTransition] = useTransition();
  const open = optimistic.filter((m) => !m.added);

  function toggle(member: WhatsappMember, added: boolean) {
    startTransition(async () => {
      setOptimistic({ whatsapp: member.whatsapp, added });
      await setWhatsappAdded(courseId, member.whatsapp, added);
    });
  }

  return (
    <div className="border border-gold-400/40 bg-white p-5">
      <p className="mb-3 text-sm text-brand-600">
        Diese Teilnehmer haben der Aufnahme in die WhatsApp-Gruppe zugestimmt. Bei Kindern ist es die Nummer
        der Eltern. Bitte verwende die Nummern nur dafür. Setze das Häkchen, sobald jemand in der Gruppe ist.
      </p>
      <ul className="divide-y divide-brand-100 text-sm">
        {optimistic.map((m) => (
          <li key={m.whatsapp} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={m.added}
                onChange={(event) => toggle(m, event.target.checked)}
                aria-label={`${m.names} ist in der WhatsApp-Gruppe`}
                className="h-4 w-4 accent-green-700"
              />
              <span className={`font-semibold ${m.added ? "text-green-800" : "text-red-700"}`}>
                {m.names}
                {!m.added && <span className="font-normal"> (neu)</span>}
              </span>
            </label>
            <span className="text-brand-700">{m.whatsapp}</span>
            <CopyButton text={m.whatsapp} ariaLabel={`Nummer von ${m.names} kopieren`} />
          </li>
        ))}
      </ul>
      {open.length > 1 && (
        <div className="mt-3 border-t border-brand-100 pt-3">
          <CopyButton
            text={open.map((m) => m.whatsapp).join("\n")}
            label={`Alle ${open.length} neuen Nummern kopieren`}
          />
        </div>
      )}
    </div>
  );
}
