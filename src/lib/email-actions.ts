"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import type { ActionResult } from "@/lib/account-actions";
import { groupRecipients } from "@/lib/enrollment-recipients";
import { getAppUrl } from "@/lib/app-url";
import { openBlob } from "@/lib/blob";
import { MAX_ATTACHMENT_TOTAL_BYTES, formatBytes, shouldSendAsLink } from "@/lib/media";
import { signedMediaPath } from "@/lib/media-links";
import { materialEmailHtml } from "@/lib/material-email";
import { prisma } from "@/lib/prisma";
import { MATERIAL_EMAIL_FROM, deliverEmail } from "@/lib/resend";

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
  const subject = text(formData, "subject").trim();
  const message = text(formData, "message").trim();
  if (subject.length < 3) errors.subject = "Bitte gib einen Betreff an.";
  else if (subject.length > 200) errors.subject = "Der Betreff ist zu lang.";
  if (message.length < 10) errors.message = "Die Nachricht ist zu kurz.";
  else if (message.length > 5000) errors.message = "Die Nachricht ist zu lang (höchstens 5000 Zeichen).";

  const courseId = text(formData, "courseId");
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      enrollments: {
        include: {
          participant: { select: { id: true, name: true, email: true } },
          user: { select: { name: true, email: true } },
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

  const recipients = groupRecipients(enrollments);
  const attachments: { filename: string; content: Buffer }[] = [];
  for (const f of files.filter((file) => !asLink.has(file.id))) {
    if (f.data) {
      attachments.push({ filename: f.fileName, content: Buffer.from(f.data) });
    } else if (f.blobPathname) {
      try {
        const blob = await openBlob(f.blobPathname);
        if (!blob?.stream) throw new Error("nicht gefunden");
        attachments.push({ filename: f.fileName, content: Buffer.from(await new Response(blob.stream).arrayBuffer()) });
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
  for (const recipient of recipients) {
    try {
      await deliverEmail({
        from: MATERIAL_EMAIL_FROM,
        to: recipient.email,
        subject,
        html: materialEmailHtml({
          studentName: recipient.greetingName,
          courseTitle: course.title,
          message,
          attachmentNames,
          links,
        }),
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    } catch (err) {
      console.error(`Kurs-E-Mail an ${recipient.email} fehlgeschlagen:`, err);
      failed.push(recipient.email);
    }
  }

  revalidatePath(`/teacher/courses/${course.id}`);
  const sent = recipients.length - failed.length;
  if (sent === 0) {
    return { ok: false, message: "Die E-Mail konnte nicht verschickt werden. Bitte versuche es später erneut." };
  }
  const parts = [`${enrollments.length} Teilnehmer`];
  if (links.length > 0) parts.push(`${links.length} ${links.length === 1 ? "Download-Link" : "Download-Links"}`);
  if (attachmentNames.length > 0) {
    parts.push(`${attachmentNames.length} ${attachmentNames.length === 1 ? "Anhang" : "Anhänge"}`);
  }
  const base = `E-Mail an ${sent} Empfänger verschickt (${parts.join(", ")}).`;
  return {
    ok: failed.length === 0,
    message: failed.length ? `${base} Nicht zugestellt an: ${failed.join(", ")}.` : base,
  };
}
