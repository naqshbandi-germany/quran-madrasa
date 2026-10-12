"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { TrashIcon } from "@/components/icons";
import {
  contactWaitlistEntry,
  removeParticipantFromCourse,
  type RemoveParticipantResult,
} from "@/lib/waitlist-actions";

export type ParticipantRow = {
  enrollmentId: string;
  name: string;
  // z. B. "(Kind, Jahrgang 2016)"
  detail: string;
  contact: string;
  since: string;
};

type Offer = NonNullable<RemoveParticipantResult["next"]>;

// Teilnehmerliste mit "Aus Kurs entfernen". Nach dem Entfernen fragt ein Pop-up, ob der naechste
// Interessent von der Warteliste angeschrieben werden soll. Der Dialog haengt an der Liste (nicht
// an der Zeile), weil die Zeile nach dem Entfernen verschwindet.
export function ParticipantsList({ rows }: { rows: ParticipantRow[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offer, setOffer] = useState<{ removedName: string; courseTitle: string; next: Offer } | null>(null);
  const [, startTransition] = useTransition();

  function remove(row: ParticipantRow) {
    const ok = window.confirm(
      `${row.name} wirklich aus dem Kurs entfernen? Das Abo wird um diesen Teilnehmer verkleinert (keine Rückerstattung für den laufenden Monat), und das Konto bekommt eine Info-Mail.`,
    );
    if (!ok) return;
    setError(null);
    setPendingId(row.enrollmentId);
    startTransition(async () => {
      const result = await removeParticipantFromCourse(row.enrollmentId);
      setPendingId(null);
      if (!result.ok) {
        setError(result.message ?? "Das Entfernen hat nicht geklappt.");
        return;
      }
      if (result.next) {
        setOffer({ removedName: result.removedName ?? row.name, courseTitle: result.courseTitle ?? "", next: result.next });
      }
    });
  }

  return (
    <>
      {error && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-brand-600">Noch keine Teilnehmer eingeschrieben.</p>
      ) : (
        <ul className="divide-y divide-brand-100 border border-gold-400/40 bg-white text-sm">
          {rows.map((row) => (
            <li key={row.enrollmentId} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-brand-900">
                  {row.name}{" "}
                  {row.detail && <span className="font-normal text-brand-600">{row.detail}</span>}
                </p>
                <p className="text-brand-600">
                  {row.contact}
                  {" · "}angemeldet am {row.since}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(row)}
                disabled={pendingId === row.enrollmentId}
                className="inline-flex shrink-0 items-center gap-1.5 font-medium text-red-800 hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60"
              >
                <TrashIcon />
                {pendingId === row.enrollmentId ? "Wird entfernt …" : "Aus Kurs entfernen"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {offer && <WaitlistOfferDialog offer={offer} onClose={() => setOffer(null)} />}
    </>
  );
}

function WaitlistOfferDialog({
  offer,
  onClose,
}: {
  offer: { removedName: string; courseTitle: string; next: Offer };
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  function contact() {
    startTransition(async () => {
      const r = await contactWaitlistEntry(offer.next.id);
      setResult({ ok: r.ok, message: r.message ?? (r.ok ? "Angeschrieben." : "Das hat nicht geklappt.") });
    });
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="offer-title"
      className="m-auto w-[min(34rem,94vw)] border border-gold-400/60 bg-white p-7 shadow-xl backdrop:bg-azure-900/55"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-gold-600">Platz frei geworden</p>
      <h2 id="offer-title" className="mt-1 text-2xl font-semibold leading-tight text-azure-800">
        Jemanden von der Warteliste anschreiben?
      </h2>
      <p className="mt-3 text-sm text-brand-900/85">
        <strong>{offer.removedName}</strong> wurde aus dem Kurs entfernt, damit ist ein Platz frei.
        Als Nächste steht auf der Warteliste:
      </p>
      <div className="mt-3 border border-gold-400/40 bg-brand-50 p-3.5 text-sm">
        <p className="font-semibold">
          {offer.next.name} <span className="font-normal text-brand-900/70">· {offer.next.email}</span>
        </p>
        <p className="text-xs text-brand-700">
          eingetragen am {offer.next.since}
          {offer.next.contacted ? " · schon einmal angeschrieben" : ""}
        </p>
      </div>
      <p className="mt-3 text-xs text-brand-900/75">
        Die Nachricht fragt, ob das Interesse weiterhin besteht, und enthält den Link zur Anmeldung.
        Der Platz wird nicht reserviert.
      </p>

      {result && (
        <p role="status" className={`mt-3 text-sm font-medium ${result.ok ? "text-brand-700" : "text-red-700"}`}>
          {result.message}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        {!result?.ok && (
          <button
            type="button"
            onClick={contact}
            disabled={pending}
            className="btn-primary btn-display flex-1 px-4 py-2.5 disabled:opacity-60"
          >
            {pending ? "Wird gesendet …" : `${offer.next.name} anschreiben`}
          </button>
        )}
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className="border border-brand-300 bg-white px-5 py-2.5 font-display text-xl font-bold text-azure-800 hover:bg-brand-50"
        >
          {result?.ok ? "Schließen" : "Später"}
        </button>
      </div>
    </dialog>
  );
}
