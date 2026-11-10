import { randomBytes, timingSafeEqual } from "node:crypto";

type AccessCourse = { isPublished: boolean; isHidden: boolean; accessCode: string | null };

// Oeffentliche Kurse sind fuer alle sichtbar. Versteckte Kurse (z. B. Testphase) nur mit dem
// geheimen Zugangscode aus dem Link /zugang/<code>.
export function canAccessCourse(course: AccessCourse, code: string | null | undefined) {
  if (!course.isPublished) return false;
  if (!course.isHidden) return true;
  if (!course.accessCode || !code) return false;
  const expected = Buffer.from(course.accessCode);
  const given = Buffer.from(code);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function generateAccessCode() {
  return randomBytes(12).toString("base64url");
}

// Anhang fuer Links innerhalb eines versteckten Kurses (Anmeldung, Abbruch der Zahlung).
export function accessQuery(course: { isHidden: boolean; accessCode: string | null }) {
  return course.isHidden && course.accessCode ? `?zugang=${encodeURIComponent(course.accessCode)}` : "";
}
