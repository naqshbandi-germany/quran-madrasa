"use client";

import { useState } from "react";

import { SURAH_OPTIONS } from "@/lib/surahs";

const INPUT = "min-w-0 border border-brand-300 bg-white px-3 py-2 text-sm";

// Auswahl von Sure und Versbereich fuer eine Hoerprobe (Felder surah, wholeSurah, fromAyah,
// toAyah; ausgewertet mit sampleRangeFromForm).
export function SampleRangeFields() {
  const [surah, setSurah] = useState("");
  const [wholeSurah, setWholeSurah] = useState(false);
  const [fromAyah, setFromAyah] = useState("");
  const [toAyah, setToAyah] = useState("");
  const ayahs = SURAH_OPTIONS.find((o) => String(o.number) === surah)?.ayahs;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-brand-800">
          Sure
          <select
            name="surah"
            required
            value={surah}
            onChange={(e) => setSurah(e.target.value)}
            className={`${INPUT} mt-1 block`}
          >
            <option value="" disabled>
              Sure wählen …
            </option>
            {SURAH_OPTIONS.map((o) => (
              <option key={o.number} value={o.number}>
                {o.number}. {o.name} ({o.ayahs} Verse)
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2.5 text-sm text-brand-800">
          <input
            type="checkbox"
            name="wholeSurah"
            checked={wholeSurah}
            onChange={(e) => setWholeSurah(e.target.checked)}
            className="h-4 w-4"
          />
          Ganze Sure
        </label>
      </div>
      {!wholeSurah && (
        <div className="flex flex-wrap gap-3">
          <label className="text-sm text-brand-800">
            Von Vers
            <input
              name="fromAyah"
              type="number"
              min={1}
              max={ayahs}
              required
              placeholder="1"
              value={fromAyah}
              onChange={(e) => setFromAyah(e.target.value)}
              className={`${INPUT} mt-1 block w-28`}
            />
          </label>
          <label className="text-sm text-brand-800">
            Bis Vers
            <input
              name="toAyah"
              type="number"
              min={1}
              max={ayahs}
              placeholder={fromAyah}
              value={toAyah}
              onChange={(e) => setToAyah(e.target.value)}
              className={`${INPUT} mt-1 block w-28`}
            />
          </label>
        </div>
      )}
    </div>
  );
}
