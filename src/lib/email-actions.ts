"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import type { ActionResult } from "@/lib/account-actions";
import { emailOptionsFromForm } from "@/lib/email-override";
import { emailRenderer } from "@/lib/email-templates";
import { groupRecipients } from "@/lib/enrollment-recipients";
import { getAppUrl } from "@/lib/app-url";
import { openBlob } from "@/lib/blob";
import { MAX_ATTACHMENT_TOTAL_BYTES, formatBytes, shouldSendAsLink } from "@/lib/media";
import { signedMediaPath } from "@/lib/media-links";
import { materialEmailHtml } from "@/lib/material-email";
import { prisma } from "@/lib/prisma";
import { MATERIAL_EMAIL_FROM, deliverEmail } from "@/lib/resend";
import { sampleRangeFromForm } from "@/lib/surahs";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// Schickt eine E-Mail der Lehrkraft an alle oder ausgewaehlte Teilnehmer eines Kurses, optional
// mit Dateien aus der Mediathek als Anhang. Lehrer duerfen nur an ihre eigenen Kurse schreiben,
// Admins an alle. Teilnehmer mit derselben Adresse (z. B. Geschwister) bekommen eine Mail.
export async function sendCourseEmail(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    throw new Error("Nicht berechtigt.");
  }
  const isAdmin = session.user.role === "ADMIN";

  const errors: Record<string, string> = {};
  const courseId = text(formData, "courseId");
  // Hoerprobe anfordern: Mail nach der Vorlage "Bitte um eine Hoerprobe" (eigene Vorlage der
  // Lehrkraft bzw. in der Vorschau angepasst) mit Knopf zur Aufnahme-Seite des Kurses.
  const isSampleRequest = text(formData, "kind") === "sample";
  const subject = text(formData, "subject").trim();
  const message = text(formData, "message").trim();
  let sample: { range: string; note: string; url: string } | null = null;
  if (isSampleRequest) {
    const range = sampleRangeFromForm(formData, errors);
    const note = text(formData, "sampleNote").trim();
    if (note.length > 1000) errors.sampleNote = "Der Hinweis ist zu lang (höchstens 1000 Zeichen).";
    if (range) {
      sample = {
        range,
        note,
        url: `${getAppUrl()}/dashboard/kurse/${courseId}/leseprobe?abschnitt=${encodeURIComponent(range)}`,
      };
    }
  } else {
    if (subject.length < 3) errors.subject = "Bitte gib einen Betreff an.";
    else if (subject.length > 200) errors.subject = "Der Betreff ist zu lang.";
    if (message.length < 10) errors.message = "Die Nachricht ist zu kurz.";
    else if (message.length > 5000) errors.message = "Die Nachricht ist zu lang (höchstens 5000 Zeichen).";
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      teacher: { select: { name: true } },
      enrollments: {
        include: {
          participant: { select: { id: true, name: true, muslimName: true, email: true } },
          user: { select: { name: true, muslimName: true, email: true } },
        },
      },
    },
  });
  if (!course) errors.courseId = "Bitte wähle einen Kurs aus.";
  else if (!isAdmin && course.teacherId !== session.user.id) throw new Error("Nicht berechtigt.");

  const mode = text(formData, "mode") === "selected" ? "selected" : "all";
  const selectedIds = new Set(formData.getAll("participantIds").filter((v): v is string => typeof v === "string"));
  const enrollments = course
    ? mode === "all"
      ? course.enrollments
      : course.enrollments.filter((e) => selectedIds.has(e.participant.id))
    : [];
  if (course && enrollments.length === 0) {
    errors.participantIds =
      mode === "all" ? "In diesem Kurs sind noch keine Teilnehmer angemeldet." : "Bitte wähle mindestens einen Teilnehmer aus.";
  }

  // Anhaenge: nur eigene Dateien (Admins: alle)
  const fileIds = [...new Set(formData.getAll("fileIds").filter((v): v is string => typeof v === "string"))];
  const files = fileIds.length
    ? await prisma.mediaFile.findMany({
        where: { id: { in: fileIds }, ...(isAdmin ? {} : { ownerId: session.user.id }) },
      })
    : [];
  if (files.length !== fileIds.length) errors.fileIds = "Eine ausgewählte Datei wurde nicht gefunden.";
  // Grosse Dateien aus dem Blob-Speicher gehen als Link, kleine als Anhang. Passen die Anhaenge
  // zusammen nicht in die Mail, werden weitere Blob-Dateien (die groessten zuerst) zu Links.
  const asLink = new Set(files.filter((f) => shouldSendAsLink(f)).map((f) => f.id));
  const attachedBytes = () => files.filter((f) => !asLink.has(f.id)).reduce((sum, f) => sum + f.sizeBytes, 0);
  for (const f of [...files].sort((a, b) => b.sizeBytes - a.sizeBytes)) {
    if (attachedBytes() <= MAX_ATTACHMENT_TOTAL_BYTES) break;
    if (f.blobPathname) asLink.add(f.id);
  }
  if (attachedBytes() > MAX_ATTACHMENT_TOTAL_BYTES) {
    errors.fileIds = `Die Anhänge sind zusammen zu groß (${formatBytes(attachedBytes())}). Erlaubt sind höchstens ${formatBytes(MAX_ATTACHMENT_TOTAL_BYTES)}.`;
  }

  if (Object.keys(errors).length > 0 || !course) {
    return { ok: false, message: "Bitte prüfe die markierten Felder.", errors };
  }

  const sampleEmail = isSampleRequest ? await emailOptionsFromForm(formData, "sample_request", session.user.id) : null;
  if (sampleEmail && !sampleEmail.ok) return { ok: false, message: sampleEmail.message };
  const renderSample = sampleEmail?.ok ? await emailRenderer("sample_request", sampleEmail.options) : null;

  const recipients = groupRecipients(enrollments);
  const attachments: { filename: string; content: Buffer }[] = [];
  for (const f of files.filter((file) => !asLink.has(file.id))) {
    if (f.data) {
      attachments.push({ filename: attachmentName(f), content: Buffer.from(f.data) });
    } else if (f.blobPathname) {
      try {
        const blob = await openBlob(f.blobPathname);
        if (!blob?.stream) throw new Error("nicht gefunden");
        attachments.push({ filename: attachmentName(f), content: Buffer.from(await new Response(blob.stream).arrayBuffer()) });
      } catch (err) {
        console.error(`Anhang ${f.fileName} konnte nicht geladen werden:`, err);
        return { ok: false, message: `Die Datei „${f.title}“ konnte nicht geladen werden. Es wurde nichts verschickt.` };
      }
    }
  }
  const attachmentNames = attachments.map((a) => a.filename);
  const links = files
    .filter((f) => asLink.has(f.id))
    .map((f) => ({ name: f.title, url: `${getAppUrl()}${signedMediaPath(f.id)}` }));

  const failed: string[] = [];
  let lastError = "";
  for (const recipient of recipients) {
    try {
      const content =
        renderSample && sample
          ? renderSample({
              name: recipient.greetingName,
              kurs: course.title,
              lehrer: course.teacher.name,
              abschnitt: sample.range,
              hinweis: sample.note,
              link: sample.url,
            })
          : {
              subject,
              html: materialEmailHtml({
                studentName: recipient.greetingName,
                courseTitle: course.title,
                message,
                attachmentNames,
                links,
              }),
            };
      await deliverEmail({
        from: MATERIAL_EMAIL_FROM,
        to: recipient.email,
        ...content,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    } catch (err) {
      console.error(`Kurs-E-Mail an ${recipient.email} fehlgeschlagen:`, err);
      failed.push(recipient.email);
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  revalidatePath(`/teacher/courses/${course.id}`);
  const sent = recipients.length - failed.length;
  if (sent === 0) {
    // Die Meldung des Mail-Dienstes mitgeben, damit sich der Fehler eingrenzen laesst.
    return {
      ok: false,
      message: `Die E-Mail konnte nicht verschickt werden${lastError ? ` (Mail-Dienst: ${lastError})` : ""}. Bitte versuche es später erneut.`,
    };
  }
  const parts = [`${enrollments.length} Teilnehmer`];
  if (links.length > 0) parts.push(`${links.length} ${links.length === 1 ? "Download-Link" : "Download-Links"}`);
  if (attachmentNames.length > 0) {
    parts.push(`${attachmentNames.length} ${attachmentNames.length === 1 ? "Anhang" : "Anhänge"}`);
  }
  const base = isSampleRequest
    ? `Hörprobe bei ${sent} Empfänger${sent === 1 ? "" : "n"} angefordert (${parts.join(", ")}).`
    : `E-Mail an ${sent} Empfänger verschickt (${parts.join(", ")}).`;
  return {
    ok: failed.length === 0,
    message: failed.length ? `${base} Nicht zugestellt an: ${failed.join(", ")}.` : base,
  };
}

// Dateiname des Anhangs: der Titel aus der Mediathek mit der Endung der Datei (statt z. B.
// "WhatsApp Image 2026-11-25 at 7.54.35 PM.jpeg"). Sonderleerzeichen und Steuerzeichen, wie sie
// in Dateinamen vom Handy vorkommen, werden ersetzt, weil Mail-Dienste daran scheitern koennen.
function attachmentName(file: { title: string; fileName: string }) {
  const clean = (value: string) =>
    value
      .normalize("NFC")
      .replace(/[\u00a0\u2000-\u200b\u202f\u205f\u3000]/g, " ")
      .replace(/[\u0000-\u001f\u007f"\/:*?<>|]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const ext = /\.[a-z0-9]{1,5}$/i.exec(file.fileName)?.[0] ?? "";
  const base = clean(file.title).replace(/\.[a-z0-9]{1,5}$/i, "") || clean(file.fileName).replace(/\.[a-z0-9]{1,5}$/i, "");
  return `${base.slice(0, 100) || "Anhang"}${ext.toLowerCase()}`;
}
