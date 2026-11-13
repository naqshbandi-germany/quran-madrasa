"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Option = { id: string; label: string };

const MAX_SECONDS = 5 * 60;
const MAX_BYTES = 4 * 1024 * 1024;
// Reihenfolge: Chrome/Firefox/Android nehmen WebM/Opus, Safari (iPhone) nimmt MP4/AAC.
const RECORDER_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"];

function pickRecorderType() {
  if (typeof MediaRecorder === "undefined") return null;
  return RECORDER_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function formatSeconds(total: number) {
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

type Recording = { blob: Blob; url: string; seconds: number | null; fileName: string };

// Leseprobe aufnehmen (Mikrofon im Browser) oder vorhandene Audiodatei hochladen.
export function ReadingSampleRecorder({
  courseId,
  participants,
  sessions,
  defaultSessionId,
}: {
  courseId: string;
  participants: Option[];
  sessions: Option[];
  defaultSessionId?: string;
}) {
  const router = useRouter();
  const [participantId, setParticipantId] = useState(participants[0]?.id ?? "");
  const [sessionId, setSessionId] = useState(defaultSessionId ?? sessions[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [isSending, setIsSending] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);

  function stopTracks() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Beim Verlassen der Seite Mikrofon freigeben und Vorschau-URL aufraeumen.
  useEffect(() => () => stopTracks(), []);
  useEffect(() => () => {
    if (recording) URL.revokeObjectURL(recording.url);
  }, [recording]);

  async function startRecording() {
    setStatus(null);
    const type = pickRecorderType();
    if (type === null || !navigator.mediaDevices?.getUserMedia) {
      setStatus({ ok: false, message: "Dein Browser kann keine Aufnahmen machen. Bitte lade eine Audiodatei hoch." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, {
        ...(type ? { mimeType: type } : {}),
        audioBitsPerSecond: 48_000,
      });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        stopTracks();
        setIsRecording(false);
        const blob = new Blob(chunks, { type: recorder.mimeType || type || "audio/webm" });
        const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
        setRecording({ blob, url: URL.createObjectURL(blob), seconds, fileName: `aufnahme.${ext}` });
      };
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(null);
      recorder.start(1000);
      setIsRecording(true);
      timerRef.current = setInterval(() => {
        const s = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(s);
        if (s >= MAX_SECONDS) recorder.stop();
      }, 250);
    } catch {
      stopTracks();
      setStatus({
        ok: false,
        message: "Kein Zugriff auf das Mikrofon. Bitte erlaube den Zugriff in den Browser-Einstellungen.",
      });
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function pickFile(file: File | undefined) {
    setStatus(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setStatus({ ok: false, message: "Die Datei ist zu groß (höchstens 4 MB, etwa 5 Minuten)." });
      return;
    }
    const url = URL.createObjectURL(file);
    setRecording({ blob: file, url, seconds: null, fileName: file.name });
    // Dauer aus den Metadaten lesen.
    const probe = new Audio();
    probe.preload = "metadata";
    probe.onloadedmetadata = () => {
      if (Number.isFinite(probe.duration)) {
        setRecording((r) => (r && r.url === url ? { ...r, seconds: probe.duration } : r));
      }
    };
    probe.src = url;
  }

  async function send() {
    if (!recording || !participantId) return;
    if (recording.seconds && recording.seconds > MAX_SECONDS + 5) {
      setStatus({ ok: false, message: "Die Aufnahme ist länger als 5 Minuten. Bitte kürze sie." });
      return;
    }
    setIsSending(true);
    setStatus(null);
    const body = new FormData();
    body.set("file", recording.blob, recording.fileName);
    body.set("participantId", participantId);
    body.set("courseId", courseId);
    if (sessionId) body.set("sessionId", sessionId);
    if (note.trim()) body.set("note", note.trim());
    if (recording.seconds) body.set("durationSec", String(Math.round(recording.seconds)));
    try {
      const res = await fetch("/api/leseproben", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus({ ok: false, message: data.error ?? "Das Hochladen hat nicht geklappt." });
        return;
      }
      setRecording(null);
      setNote("");
      setStatus({ ok: true, message: "Danke! Die Leseprobe ist bei der Lehrkraft angekommen." });
      router.refresh();
    } catch {
      setStatus({ ok: false, message: "Keine Verbindung. Bitte versuche es noch einmal." });
    } finally {
      setIsSending(false);
    }
  }

  const selectClass = "mt-1 border border-brand-300 bg-white px-3 py-2";

  return (
    <div className="space-y-4 border border-gold-400/40 bg-white p-5 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        {participants.length > 1 ? (
          <label className="flex flex-col text-brand-700">
            Wer liest?
            <select value={participantId} onChange={(e) => setParticipantId(e.target.value)} className={selectClass}>
              {participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-brand-700">
            Teilnehmer: <span className="font-medium text-brand-900">{participants[0]?.label}</span>
          </p>
        )}
        <label className="flex flex-col text-brand-700">
          Für welche Stunde?
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} className={selectClass}>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
            <option value="">keine bestimmte Stunde</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {isRecording ? (
          <button type="button" onClick={stopRecording} className="btn-primary px-4 py-2">
            ■ Aufnahme beenden
          </button>
        ) : (
          <button type="button" onClick={startRecording} className="btn-primary px-4 py-2">
            ● {recording ? "Neu aufnehmen" : "Aufnahme starten"}
          </button>
        )}
        {isRecording && (
          <span role="status" className="font-medium text-red-800">
            Aufnahme läuft {formatSeconds(elapsed)} / {formatSeconds(MAX_SECONDS)}
          </span>
        )}
        {!isRecording && (
          <label className="cursor-pointer text-brand-700 underline">
            oder Audiodatei wählen
            <input
              type="file"
              accept="audio/*"
              className="sr-only"
              onChange={(e) => {
                pickFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      {recording && !isRecording && (
        <div className="space-y-3 border-t border-brand-100 pt-3">
          <p className="text-brand-700">
            Vorschau{recording.seconds ? ` (${formatSeconds(recording.seconds)})` : ""}:
          </p>
          <audio controls src={recording.url} className="w-full" />
          <label className="flex flex-col text-brand-700">
            Hinweis an die Lehrkraft (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="z. B. Verse 1–10, beim Idgham unsicher"
              className={selectClass}
            />
          </label>
          <button type="button" onClick={send} disabled={isSending} className="btn-primary px-4 py-2 disabled:opacity-60">
            {isSending ? "Wird hochgeladen …" : "An die Lehrkraft senden"}
          </button>
        </div>
      )}

      {status && (
        <p role={status.ok ? "status" : "alert"} className={`font-medium ${status.ok ? "text-green-800" : "text-red-700"}`}>
          {status.message}
        </p>
      )}

      <p className="text-xs text-brand-600">
        Höchstens 5 Minuten. Die Aufnahme hört nur die Lehrkraft (andere Teilnehmer nicht) und wird
        nach 6 Monaten automatisch gelöscht. Du kannst sie vorher jederzeit selbst löschen.
      </p>
    </div>
  );
}
