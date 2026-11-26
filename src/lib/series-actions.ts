"use server";

import { Weekday } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { sendSeriesChangeNotice } from "@/lib/notification-email";
import { prisma } from "@/lib/prisma";
import {
  convertSeriesZone,
  MAX_SERIES_DAYS,
  removeUpcomingSeriesSessions,
  syncSeriesSessions,
  syncSeriesSlots,
  type SyncResult,
} from "@/lib/series";
import { teacherTimeZone } from "@/lib/time-zones";
import { resolveViewTimeZone } from "@/lib/view-time-zone";

// Aktionen fuer Terminserien und den Kursstatus (Reiter Sitzungen und Einstellungen). Nach jeder
// Aktion geht es zurueck in den Reiter Sitzungen, mit einem Hinweis oder einer Fehlermeldung
// oben auf der Seite (statt einer Fehlerseite).

async function requireCourse(courseId: string) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new Error("Kurs nicht gefunden.");
  if (session.user.role !== "ADMIN" && course.teacherId !== session.user.id) throw new Error("Nicht berechtigt.");
  return { ...course, userId: session.user.id };
}

// Angezeigte Zeitzone (Eingaben) und Ortszeit der Lehrkraft des Kurses (Speicherung).
async function seriesZones(userId: string, teacherId: string) {
  const [{ timeZone: viewTimeZone }, teacher] = await Promise.all([
    resolveViewTimeZone(userId),
    prisma.user.findUnique({ where: { id: teacherId }, select: { timeZone: true } }),
  ]);
  return { viewTimeZone, courseTimeZone: teacherTimeZone(teacher) };
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function revalidate(courseId: string, slug: string) {
  revalidatePath(`/teacher/courses/${courseId}`, "layout");
  revalidatePath("/teacher");
  revalidatePath("/teacher/kurse");
  revalidatePath("/teacher/termine");
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath("/quran");
  revalidatePath("/stundenplan");
  revalidatePath(`/courses/${slug}`);
}

function back(courseId: string, message: string, kind: "hinweis" | "fehler" = "hinweis"): never {
  redirect(`/teacher/courses/${courseId}/sitzungen?${kind}=${encodeURIComponent(message)}`);
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function summary(result: SyncResult) {
  const parts = [
    result.created > 0 && `${result.created} ${result.created === 1 ? "Stunde" : "Stunden"} angelegt`,
    result.updated > 0 && `${result.updated} angepasst`,
    result.removed > 0 && `${result.removed} entfernt`,
  ].filter(Boolean);
  return [parts.length > 0 ? `${parts.join(", ")}.` : "", ...result.warnings].filter(Boolean).join(" ");
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

export type SeriesFormState = { errors?: Partial<Record<SeriesField, string>> };
export type SeriesField = "courseId" | "title" | "weekdays" | "startTime" | "endTime" | "firstDate" | "lastDate" | "form";

// Serie anlegen oder aendern (Formular mit useActionState). Fehler kommen je Feld zurueck, das
// Formular behaelt die Eingaben. Ist der Kurs gestartet, werden die kommenden Stunden
// angeglichen und die Teilnehmer bei einer Aenderung einmal per Mail informiert. Nach dem
// Speichern geht es in den Reiter Sitzungen des Kurses.
export async function saveSeries(_prev: SeriesFormState, formData: FormData): Promise<SeriesFormState> {
  const courseId = text(formData, "courseId");
  if (!courseId) return { errors: { courseId: "Bitte einen Kurs wählen." } };
  const course = await requireCourse(courseId);

  const seriesIdInput = text(formData, "seriesId") || undefined;
  // Ohne Titel (Termine > Termin anlegen) gilt der Kurstitel.
  const title = text(formData, "title") || course.title;
  const weekdays = formData.getAll("weekdays").filter((d): d is Weekday => Object.values(Weekday).includes(d as Weekday));
  const startTime = text(formData, "startTime");
  const endTime = text(formData, "endTime");
  const firstText = text(formData, "firstDate");
  const lastText = text(formData, "lastDate");
  const note = text(formData, "note") || null;

  const errors: SeriesFormState["errors"] = {};
  if (title.length < 3) errors.title = "Der Titel braucht mindestens 3 Zeichen.";
  if (weekdays.length === 0) errors.weekdays = "Bitte mindestens einen Wochentag wählen.";
  if (!TIME.test(startTime)) errors.startTime = "Bitte eine Uhrzeit angeben.";
  if (!TIME.test(endTime)) errors.endTime = "Bitte eine Uhrzeit angeben.";
  else if (TIME.test(startTime) && endTime <= startTime) errors.endTime = "Das Ende muss nach dem Beginn liegen.";
  if (firstText && !DATE.test(firstText)) errors.firstDate = "Ungültiges Datum.";
  if (lastText && !DATE.test(lastText)) errors.lastDate = "Ungültiges Datum.";
  const firstDate = DATE.test(firstText) ? new Date(`${firstText}T00:00:00Z`) : null;
  const lastDate = DATE.test(lastText) ? new Date(`${lastText}T00:00:00Z`) : null;
  if (firstDate && lastDate) {
    if (lastDate < firstDate) errors.lastDate = "Der letzte Tag liegt vor dem ersten.";
    else if ((lastDate.getTime() - firstDate.getTime()) / 86_400_000 > MAX_SERIES_DAYS) {
      errors.lastDate = "Eine Serie kann höchstens ein Jahr lang sein.";
    }
  } else if (firstDate || lastDate || course.startedAt) {
    // Halber Zeitraum ergibt keinen Sinn; bei einem laufenden Kurs ist er Pflicht.
    if (!firstDate && !errors.firstDate)
      errors.firstDate = course.startedAt ? "Der Kurs läuft schon: Bitte den ersten Tag angeben." : "Bitte auch den ersten Tag angeben.";
    if (!lastDate && !errors.lastDate)
      errors.lastDate = course.startedAt ? "Der Kurs läuft schon: Bitte den letzten Tag angeben." : "Bitte auch den letzten Tag angeben.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  // Eingegeben in der angezeigten Zeitzone, gespeichert in der Ortszeit der Lehrkraft.
  const { viewTimeZone, courseTimeZone } = await seriesZones(course.userId, course.teacherId);
  const local = convertSeriesZone({ weekdays, startTime, endTime }, viewTimeZone, courseTimeZone);
  const fields = {
    title,
    weekdays: local.weekdays,
    startTime: local.startTime,
    endTime: local.endTime,
    firstDate,
    lastDate,
    note,
  };

  let seriesId = seriesIdInput;
  if (seriesId) {
    const existing = await prisma.sessionSeries.findUnique({ where: { id: seriesId } });
    if (!existing || existing.courseId !== courseId) return { errors: { form: "Diese Serie gibt es nicht mehr." } };
    await prisma.sessionSeries.update({ where: { id: seriesId }, data: fields });
  } else {
    seriesId = (await prisma.sessionSeries.create({ data: { courseId, ...fields } })).id;
  }
  await syncSeriesSlots(seriesId);

  let message = seriesIdInput ? "Serie gespeichert." : "Serie angelegt.";
  let failed = false;
  try {
    const result = await syncSeriesSessions(seriesId, { notify: Boolean(seriesIdInput) });
    message = `${message} ${summary(result)}`.trim();
    if (!course.startedAt) message += " Die Stunden mit Zoom-Links entstehen, sobald du den Kurs startest.";
  } catch (err) {
    failed = true;
    message = `Serie gespeichert, aber die Stunden konnten nicht angelegt werden: ${errorText(err)}`;
  }

  revalidate(courseId, course.slug);
  back(courseId, message, failed ? "fehler" : "hinweis");
}

// Serie beenden: kommende Stunden entfernen. Hat die Serie schon stattgefundene Stunden, bleibt
// sie mit verkuerztem Zeitraum erhalten (fuer die Auswertung), sonst wird sie geloescht.
export async function endSeries(formData: FormData) {
  const courseId = text(formData, "courseId");
  const course = await requireCourse(courseId);
  const series = await prisma.sessionSeries.findUnique({
    where: { id: text(formData, "seriesId") },
    include: { sessions: { where: { startsAt: { lte: new Date() } }, select: { id: true } } },
  });
  if (!series || series.courseId !== courseId) back(courseId, "Diese Serie gibt es nicht mehr.", "fehler");

  const removed = await removeUpcomingSeriesSessions(series.id);
  if (series.sessions.length > 0) {
    const today = new Date();
    await prisma.sessionSeries.update({
      where: { id: series.id },
      data: { lastDate: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) },
    });
    // Beendete Serie steht nicht mehr im Stundenplan.
    await prisma.scheduleSlot.deleteMany({ where: { seriesId: series.id } });
  } else {
    await prisma.sessionSeries.delete({ where: { id: series.id } });
  }
  if (removed > 0) {
    await sendSeriesChangeNotice(courseId, `Die Termine „${series.title}“ enden. Es finden keine weiteren Stunden dieser Serie statt.`);
  }

  revalidate(courseId, course.slug);
  back(courseId, removed > 0 ? `Serie beendet, ${removed} kommende Stunden entfernt.` : "Serie entfernt.");
}

// "Kurs starten": Ab jetzt entstehen aus allen Serien die Stunden mit Zoom-Link und Erinnerungen.
export async function startCourse(formData: FormData) {
  const courseId = text(formData, "courseId");
  const course = await requireCourse(courseId);
  if (course.startedAt) back(courseId, "Der Kurs läuft bereits.");

  const series = await prisma.sessionSeries.findMany({ where: { courseId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  if (series.length === 0) back(courseId, "Lege zuerst eine Terminserie an.", "fehler");
  const undated = series.filter((s) => !s.firstDate || !s.lastDate);
  if (undated.length > 0) {
    back(
      courseId,
      `Bitte trage bei ${undated.length === 1 ? "der Serie" : "den Serien"} „${undated.map((s) => s.title).join("“, „")}“ den ersten und letzten Tag ein, dann kannst du den Kurs starten.`,
      "fehler",
    );
  }

  await prisma.course.update({ where: { id: courseId }, data: { startedAt: new Date() } });
  const results: SyncResult[] = [];
  try {
    for (const s of series) results.push(await syncSeriesSessions(s.id));
  } catch (err) {
    revalidate(courseId, course.slug);
    back(
      courseId,
      `Der Kurs ist gestartet, aber nicht alle Stunden konnten angelegt werden: ${errorText(err)} Speichere die betroffene Serie erneut, sobald das Problem behoben ist.`,
      "fehler",
    );
  }
  const created = results.reduce((sum, r) => sum + r.created, 0);

  revalidate(courseId, course.slug);
  back(courseId, `Der Kurs läuft. ${created} Stunden mit Meeting-Link angelegt, die Teilnehmer werden vor jeder Stunde erinnert.`);
}
