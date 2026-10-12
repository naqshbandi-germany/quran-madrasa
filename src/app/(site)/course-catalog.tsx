"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  AGE_GROUP_LABELS,
  formatPrice,
  formatSchedule,
  type CatalogCourse,
} from "@/lib/course-labels";
import { miniatureFor } from "@/lib/miniatures";

export type { CatalogCourse };

// Reiter ueber der Kursliste. "Korankurse" sind alle Kurse mit dem Thema "Quran-Rezitation".
const QURAN_CATEGORY = "Quran-Rezitation";

type TabKey = "all" | "quran" | "other";

const TABS: { key: TabKey; label: string; matches: (course: CatalogCourse) => boolean }[] = [
  { key: "all", label: "Alle Kurse", matches: () => true },
  { key: "quran", label: "Korankurse", matches: (course) => course.category === QURAN_CATEGORY },
  { key: "other", label: "Weitere Kurse", matches: (course) => course.category !== QURAN_CATEGORY },
];

export function CourseCatalog({ courses }: { courses: CatalogCourse[] }) {
  const [tab, setTab] = useState<TabKey>("all");

  const filtered = useMemo(() => {
    const active = TABS.find((t) => t.key === tab) ?? TABS[0];
    return courses.filter(active.matches).sort((a, b) => a.title.localeCompare(b.title, "de"));
  }, [courses, tab]);

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Kurse anzeigen" className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              aria-pressed={active}
              onClick={() => setTab(t.key)}
              className={`border px-5 py-2 font-display text-xl font-bold transition-colors duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700 ${
                active
                  ? "border-brass bg-brass text-white"
                  : "border-gold-400/60 bg-white text-azure-800 hover:border-brass"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-brand-600">In dieser Auswahl gibt es zurzeit keine Kurse.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filtered.map((course) => {
            const miniature = miniatureFor(course);
            return (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className="flex gap-4 border border-gold-400/40 bg-white p-4 transition hover:border-gold-400"
              >
                {miniature && (
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden border border-gold-400/40 bg-brand-100 sm:h-28 sm:w-28">
                    <Image
                      src={miniature.src}
                      alt=""
                      fill
                      sizes="112px"
                      className="object-cover"
                      style={{ objectPosition: miniature.focus }}
                    />
                  </div>
                )}

                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-gold-600">
                    {course.category}
                    {course.level ? ` · ${course.level}` : ""}
                    {course.isFull && (
                      <span className="ml-2 bg-azure-800 px-2 py-0.5 font-semibold tracking-[0.1em] text-white">
                        Ausgebucht
                      </span>
                    )}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-semibold leading-snug text-azure-800">
                    {course.title}
                  </h3>
                  <p className="mt-1 line-clamp-3 text-sm text-brand-900/75">{course.description}</p>

                  {course.ageGroups.length > 0 && (
                    <p className="mt-2 text-xs text-brand-600">
                      {course.ageGroups.map((ag) => AGE_GROUP_LABELS[ag] ?? ag).join(" · ")}
                    </p>
                  )}

                  {course.scheduleSlots.length > 0 && (
                    <p className="mt-2 text-xs text-brand-900/75">
                      <span className="mr-1.5 rounded-full border border-gold-400/60 px-2 py-0.5 font-medium text-azure-800">
                        {course.scheduleSlots.length}× / Woche
                      </span>
                      {formatSchedule(course.scheduleSlots)}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 pt-3 text-sm">
                    <span className="text-brand-900/70">{course.teacherName}</span>
                    <span className="font-semibold text-brand-700">
                      {course.priceCents > 0
                        ? `${formatPrice(course.priceCents, course.currency)} / Monat`
                        : "Preis auf Anfrage"}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
