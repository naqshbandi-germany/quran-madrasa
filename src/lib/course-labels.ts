// Reines Daten-/Label-Modul (kein "use client"), damit es sowohl von Server
// Components (Kurs-Detailseite, Lehrer-Bereich) als auch vom Client Component
// CourseCatalog importiert werden kann. Ein Import aus einer "use client"-Datei
// heraus liefert auf dem Server nur eine Client-Referenz statt der echten Werte.

export type ScheduleSlot = {
  weekday: string;
  startTime: string;
  endTime: string;
  note: string | null;
};

export type CatalogCourse = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  level: string | null;
  ageGroups: string[];
  priceCents: number;
  currency: string;
  teacherName: string;
  scheduleSlots: ScheduleSlot[];
};

export const AGE_GROUP_LABELS: Record<string, string> = {
  KIDS: "Kinder (6-13)",
  TEENS: "Jugendliche (14-22)",
  ADULTS: "Erwachsene (23+)",
};

export const WEEKDAY_LABELS: Record<string, string> = {
  MONDAY: "Montag",
  TUESDAY: "Dienstag",
  WEDNESDAY: "Mittwoch",
  THURSDAY: "Donnerstag",
  FRIDAY: "Freitag",
  SATURDAY: "Samstag",
  SUNDAY: "Sonntag",
};

export const WEEKDAY_SHORT: Record<string, string> = {
  MONDAY: "Mo",
  TUESDAY: "Di",
  WEDNESDAY: "Mi",
  THURSDAY: "Do",
  FRIDAY: "Fr",
  SATURDAY: "Sa",
  SUNDAY: "So",
};

export const WEEKDAY_ORDER = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(cents / 100);
}

export function formatSchedule(slots: ScheduleSlot[]) {
  return slots
    .map((s) => {
      const day = WEEKDAY_SHORT[s.weekday] ?? s.weekday;
      const note = s.note ? ` (${s.note})` : "";
      return `${day} ${s.startTime}–${s.endTime}${note}`;
    })
    .join(" · ");
}
