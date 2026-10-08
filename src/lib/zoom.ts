// Anbindung an die Zoom-API ueber eine "Server-to-Server OAuth"-App (kein Nutzer-Login
// noetig). Einrichtung und benoetigte Umgebungsvariablen: siehe README, Abschnitt Zoom.
// Die Umgebungsvariablen werden erst beim Aufruf gelesen (nicht beim Laden des Moduls),
// damit der Build auch ohne Zoom-Zugangsdaten funktioniert.

const OAUTH_URL = "https://zoom.us/oauth/token";
const API_BASE = "https://api.zoom.us/v2";

type ZoomEnv = { accountId: string; clientId: string; clientSecret: string };

function readEnv(): ZoomEnv | null {
  const accountId = process.env.ZOOM_ACCOUNT_ID?.trim();
  const clientId = process.env.ZOOM_CLIENT_ID?.trim();
  const clientSecret = process.env.ZOOM_CLIENT_SECRET?.trim();
  return accountId && clientId && clientSecret ? { accountId, clientId, clientSecret } : null;
}

export function isZoomConfigured() {
  return readEnv() !== null;
}

export function defaultZoomHostEmail() {
  return process.env.ZOOM_HOST_EMAIL?.trim() || null;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(env: ZoomEnv) {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const credentials = Buffer.from(`${env.clientId}:${env.clientSecret}`).toString("base64");
  const response = await fetch(
    `${OAUTH_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(env.accountId)}`,
    { method: "POST", headers: { Authorization: `Basic ${credentials}` } },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw new Error(
      `Zoom-Anmeldung fehlgeschlagen: ${data.reason ?? data.message ?? response.status}`,
    );
  }

  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function zoomRequest(path: string, init: RequestInit) {
  const env = readEnv();
  if (!env) throw new Error("Zoom ist nicht konfiguriert (siehe .env.example).");

  const token = await getAccessToken(env);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Zoom-Fehler (${response.status}): ${data.message ?? "unbekannt"}`);
  }
  return data;
}

export type ZoomMeeting = { id: string; joinUrl: string };

// Legt ein einzelnes Meeting im Zoom-Konto des Hosts an. Schueler brauchen weder
// Zoom-Konto noch Anmeldung; der Teilnehmer-Link enthaelt das Kennwort bereits.
export async function createZoomMeeting(params: {
  hostEmail: string;
  topic: string;
  startsAt: Date;
  durationMin: number;
}): Promise<ZoomMeeting> {
  const data = await zoomRequest(`/users/${encodeURIComponent(params.hostEmail)}/meetings`, {
    method: "POST",
    body: JSON.stringify({
      topic: params.topic,
      type: 2,
      // Zoom erwartet UTC im Format yyyy-MM-ddTHH:mm:ssZ.
      start_time: params.startsAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
      duration: params.durationMin,
      timezone: "Europe/Berlin",
      settings: {
        join_before_host: false,
        waiting_room: false,
        mute_upon_entry: true,
        participant_video: false,
        host_video: true,
        approval_type: 2,
        meeting_authentication: false,
        auto_recording: "none",
      },
    }),
  });

  return { id: String(data.id), joinUrl: data.join_url };
}

// Best-effort-Aufraeumen (z.B. wenn beim Anlegen mehrerer Meetings eines fehlschlaegt).
export async function deleteZoomMeeting(meetingId: string) {
  try {
    await zoomRequest(`/meetings/${encodeURIComponent(meetingId)}`, { method: "DELETE" });
  } catch (err) {
    console.error(`Zoom-Meeting ${meetingId} konnte nicht geloescht werden:`, err);
  }
}

// Aendert Thema, Beginn und Dauer eines bestehenden Meetings (z. B. wenn der Termin
// verschoben wird). Der Teilnehmer-Link bleibt gleich.
export async function updateZoomMeeting(
  meetingId: string,
  params: { topic: string; startsAt: Date; durationMin: number },
) {
  await zoomRequest(`/meetings/${encodeURIComponent(meetingId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      topic: params.topic,
      start_time: params.startsAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
      duration: params.durationMin,
      timezone: "Europe/Berlin",
    }),
  });
}
