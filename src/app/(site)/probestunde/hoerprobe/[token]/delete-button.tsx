"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Hoerprobe ueber den persoenlichen Link loeschen (Gast ohne Konto).
export function GuestSampleDeleteButton({ sampleId, token }: { sampleId: string; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Diese Hörprobe endgültig löschen?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/probestunde/hoerprobe/${sampleId}?t=${encodeURIComponent(token)}`, { method: "DELETE" }).catch(
      () => null,
    );
    setBusy(false);
    if (!res?.ok) {
      setError("Das Löschen hat nicht geklappt.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="text-xs font-medium text-red-800 underline hover:text-red-700 disabled:opacity-60"
      >
        Löschen
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
