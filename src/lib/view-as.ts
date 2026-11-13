// Entwicklermodus "Ansehen als": Ein Admin sieht die Website wie ein bestimmter Lehrer oder
// Schueler. Das Cookie VIEW_AS_COOKIE (httpOnly) enthaelt die ID der Person und wirkt nur, wenn
// der angemeldete Nutzer wirklich Admin ist (siehe auth() in src/auth.ts). VIEW_AS_INFO_COOKIE
// (lesbar im Browser) traegt nur Name und Rolle fuer Hinweisleiste und Benutzermenue.
// Waehrend der Ansicht sind Aenderungen gesperrt (src/proxy.ts blockiert alles ausser GET).
export const VIEW_AS_COOKIE = "ansicht-als";
export const VIEW_AS_INFO_COOKIE = "ansicht-als-info";
export const VIEW_AS_MAX_AGE = 60 * 60 * 4;
export const VIEW_AS_EXIT_PATH = "/api/ansicht/beenden";

export type ViewAsInfo = { name: string; email: string; role: "STUDENT" | "TEACHER" };
