"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  AGE_GROUP_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_ORDER,
  formatPrice,
  formatSchedule,
  type CatalogCourse,
} from "@/lib/course-labels";
import { miniatureFor } from "@/lib/miniatures";

export type { CatalogCourse };

const ALL = "__all__";

// Dünne farbige Oberkante der Karten, je Thema abwechselnd Blau/Gruen (stabil pro Thema).
function accentFor(category: string) {
  const sum = [...category].reduce((total, ch) => total + ch.charCodeAt(0), 0);
  return sum % 2 === 0 ? "border-t-azure-700" : "border-t-brand-600";
}
type SortKey = "title" | "teacher" | "level" | "price" | "category";

const SORT_LABELS: Record<SortKey, string> = {
  title: "Titel (A-Z)",
  teacher: "Lehrer",
  level: "Level",
  price: "Preis",
  category: "Thema",
};

export function CourseCatalog({ courses }: { courses: CatalogCourse[] }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL);
  const [ageGroup, setAgeGroup] = useState(ALL);
  const [teacher, setTeacher] = useState(ALL);
  const [level, setLevel] = useState(ALL);
  const [weekday, setWeekday] = useState(ALL);
  const [sortBy, setSortBy] = useState<SortKey>("title");

  const categories = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category))).sort((a, b) => a.localeCompare(b, "de")),
    [courses],
  );
  const teachers = useMemo(
    () => Array.from(new Set(courses.map((c) => c.teacherName))).sort((a, b) => a.localeCompare(b, "de")),
    [courses],
  );
  const levels = useMemo(
    () =>
      Array.from(new Set(courses.map((c) => c.level).filter((l): l is string => Boolean(l)))).sort(
        (a, b) => a.localeCompare(b, "de"),
      ),
    [courses],
  );
  const weekdays = useMemo(
    () => WEEKDAY_ORDER.filter((day) => courses.some((c) => c.scheduleSlots.some((s) => s.weekday === day))),
    [courses],
  );
  const ageGroupsPresent = useMemo(
    () => Object.keys(AGE_GROUP_LABELS).filter((ag) => courses.some((c) => c.ageGroups.includes(ag))),
    [courses],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const result = courses.filter((course) => {
      if (category !== ALL && course.category !== category) return false;
      if (ageGroup !== ALL && !course.ageGroups.includes(ageGroup)) return false;
      if (teacher !== ALL && course.teacherName !== teacher) return false;
      if (level !== ALL && course.level !== level) return false;
      if (weekday !== ALL && !course.scheduleSlots.some((s) => s.weekday === weekday)) return false;
      if (term) {
        const haystack = `${course.title} ${course.description}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case "teacher":
          return a.teacherName.localeCompare(b.teacherName, "de");
        case "level":
          return (a.level ?? "").localeCompare(b.level ?? "", "de");
        case "price":
          return a.priceCents - b.priceCents;
        case "category":
          return a.category.localeCompare(b.category, "de");
        case "title":
        default:
          return a.title.localeCompare(b.title, "de");
      }
    });
  }, [courses, search, category, ageGroup, teacher, level, weekday, sortBy]);

  const filtersActive =
    search !== "" ||
    category !== ALL ||
    ageGroup !== ALL ||
    teacher !== ALL ||
    level !== ALL ||
    weekday !== ALL;

  const resetFilters = () => {
    setSearch("");
    setCategory(ALL);
    setAgeGroup(ALL);
    setTeacher(ALL);
    setLevel(ALL);
    setWeekday(ALL);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-brand-200 bg-white p-4">
        <label className="flex flex-col text-sm text-brand-700">
          Suche
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Kurs suchen…"
            className="mt-1 rounded-md border border-brand-300 px-3 py-1.5"
          />
        </label>

        <label className="flex flex-col text-sm text-brand-700">
          Thema
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 rounded-md border border-brand-300 px-3 py-1.5"
          >
            <option value={ALL}>Alle Themen</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {ageGroupsPresent.length > 0 && (
          <label className="flex flex-col text-sm text-brand-700">
            Altersgruppe
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="mt-1 rounded-md border border-brand-300 px-3 py-1.5"
            >
              <option value={ALL}>Alle Altersgruppen</option>
              {ageGroupsPresent.map((ag) => (
                <option key={ag} value={ag}>
                  {AGE_GROUP_LABELS[ag]}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col text-sm text-brand-700">
          Lehrer
          <select
            value={teacher}
            onChange={(e) => setTeacher(e.target.value)}
            className="mt-1 rounded-md border border-brand-300 px-3 py-1.5"
          >
            <option value={ALL}>Alle Lehrer</option>
            {teachers.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        {levels.length > 0 && (
          <label className="flex flex-col text-sm text-brand-700">
            Level
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="mt-1 rounded-md border border-brand-300 px-3 py-1.5"
            >
              <option value={ALL}>Alle Level</option>
              {levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}

        {weekdays.length > 0 && (
          <label className="flex flex-col text-sm text-brand-700">
            Wochentag
            <select
              value={weekday}
              onChange={(e) => setWeekday(e.target.value)}
              className="mt-1 rounded-md border border-brand-300 px-3 py-1.5"
            >
              <option value={ALL}>Alle Wochentage</option>
              {weekdays.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_LABELS[d]}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="flex flex-col text-sm text-brand-700">
          Sortieren nach
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="mt-1 rounded-md border border-brand-300 px-3 py-1.5"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        {filtersActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="ml-auto self-end rounded-md border border-brand-300 px-3 py-1.5 text-sm text-brand-700 hover:bg-brand-50"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      <p className="text-sm text-brand-600">
        {filtered.length} von {courses.length} Kursen
      </p>

      {filtered.length === 0 ? (
        <p className="text-brand-600">Keine Kurse gefunden. Versuch andere Filter.</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {filtered.map((course) => {
            const miniature = miniatureFor(course);
            return (
              <Link
                key={course.id}
                href={`/courses/${course.slug}`}
                className={`flex gap-4 rounded-md border border-t-[3px] border-brand-200 bg-white p-4 shadow-sm transition hover:shadow-md ${accentFor(course.category)}`}
              >
                {miniature && (
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-md border border-brand-200 bg-brand-100 sm:h-28 sm:w-28">
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
                  <p className="text-[11px] uppercase tracking-[0.16em] text-azure-700">
                    {course.category}
                    {course.level ? ` · ${course.level}` : ""}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-semibold leading-snug text-brand-900">
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
                      <span className="mr-1.5 rounded-full border border-azure-700/30 px-2 py-0.5 font-medium text-azure-800">
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
