import { ClassroomType } from "@prisma/client";

import { generateJitsiUrl } from "@/lib/jitsi";
import {
  createZoomMeeting,
  defaultZoomHostEmail,
  deleteZoomMeeting,
  isZoomConfigured,
} from "@/lib/zoom";

export type ClassroomMeeting = {
  joinUrl: string;
  classroomType: ClassroomType;
  zoomMeetingId: string | null;
};

// Welcher Dienst fuer neue Sitzungen genutzt wird, steuert die Umgebungsvariable
// CLASSROOM_PROVIDER ("jitsi" = Standard, "zoom"). Bereits angelegte Sitzungen behalten
// ihren Link, ein Wechsel ist daher jederzeit und in beide Richtungen moeglich.
export function isZoomProvider() {
  return process.env.CLASSROOM_PROVIDER?.trim().toLowerCase() === "zoom";
}

type MeetingRequest = {
  courseSlug: string;
  title: string;
  startsAt: Date;
  durationMin: number;
  // Zoom-Konto des Lehrers (User.zoomEmail); sonst gilt ZOOM_HOST_EMAIL.
  teacherZoomEmail: string | null;
};

export async function createClassroomMeeting(request: MeetingRequest): Promise<ClassroomMeeting> {
  if (!isZoomProvider()) {
    return {
      joinUrl: generateJitsiUrl(request.courseSlug),
      classroomType: ClassroomType.JITSI,
      zoomMeetingId: null,
    };
  }

  if (!isZoomConfigured()) {
    throw new Error(
      "CLASSROOM_PROVIDER=zoom ist gesetzt, aber die Zoom-Zugangsdaten fehlen (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET).",
    );
  }
  const hostEmail = request.teacherZoomEmail || defaultZoomHostEmail();
  if (!hostEmail) {
    throw new Error(
      "Für dieses Zoom-Meeting fehlt das Zoom-Konto des Lehrers (Admin-Bereich) oder ZOOM_HOST_EMAIL.",
    );
  }

  const meeting = await createZoomMeeting({
    hostEmail,
    topic: request.title,
    startsAt: request.startsAt,
    durationMin: request.durationMin,
  });
  return { joinUrl: meeting.joinUrl, classroomType: ClassroomType.ZOOM, zoomMeetingId: meeting.id };
}

// Legt mehrere Meetings nacheinander an. Schlaegt eines fehl, werden bereits angelegte
// Zoom-Meetings wieder geloescht, damit keine verwaisten Termine im Zoom-Konto bleiben.
export async function createClassroomMeetings(requests: MeetingRequest[]) {
  const created: ClassroomMeeting[] = [];
  try {
    for (const request of requests) {
      created.push(await createClassroomMeeting(request));
    }
  } catch (err) {
    await Promise.all(
      created.flatMap((meeting) => (meeting.zoomMeetingId ? [deleteZoomMeeting(meeting.zoomMeetingId)] : [])),
    );
    throw err;
  }
  return created;
}
