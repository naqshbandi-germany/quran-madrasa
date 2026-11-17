"use client";

import { useEffect, useRef, useState } from "react";

// Wellenform fuer Aufnahmen: live waehrend der Aufnahme (laeuft von rechts nach links mit) und
// als Gesamtbild der fertigen Aufnahme. Dazu eine Pegel-Ampel, damit man sofort merkt, wenn das
// Mikrofon nichts oder zu leise aufnimmt.

const SAMPLE_MS = 50; // ein Balken pro 50 ms
const BAR = 3;
const GAP = 2;
const WINDOW_MS = 3000; // Pegelbewertung ueber die letzten 3 Sekunden
const SILENT_RMS = 0.004;
const QUIET_RMS = 0.02;

// Lautstaerke (RMS, 0..1) auf Balkenhoehe (0..1); die Wurzel macht leise Stellen sichtbar.
export function levelToHeight(rms: number) {
  return Math.min(1, Math.sqrt(rms) * 1.8);
}

function drawBars(canvas: HTMLCanvasElement, heights: number[], align: "right" | "fit") {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const color = getComputedStyle(canvas).color;
  const mid = height / 2;

  // Mittellinie, damit auch Stille als "laeuft" erkennbar ist.
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(0, mid - 0.5, width, 1);
  ctx.globalAlpha = 1;

  const slots = Math.floor(width / (BAR + GAP));
  let values = heights;
  if (align === "fit" && heights.length > slots) {
    // Gesamtbild: auf die verfuegbaren Balken verdichten (Maximum je Abschnitt).
    values = Array.from({ length: slots }, (_, i) => {
      const start = Math.floor((i * heights.length) / slots);
      const end = Math.max(start + 1, Math.floor(((i + 1) * heights.length) / slots));
      return Math.max(...heights.slice(start, end));
    });
  }
  const visible = values.slice(-slots);
  // Live: rechtsbuendig mit festem Abstand. Gesamtbild: ueber die volle Breite verteilt.
  const step = align === "fit" && visible.length > 0 ? width / visible.length : BAR + GAP;
  const offset = align === "right" ? width - visible.length * step : 0;
  visible.forEach((h, i) => {
    const barHeight = Math.max(2, h * (height - 4));
    ctx.fillRect(offset + i * step, mid - barHeight / 2, Math.min(BAR, step), barHeight);
  });
}

type Level = "wait" | "silent" | "quiet" | "good";

const LEVEL_TEXT: Record<Level, { text: string; className: string }> = {
  wait: { text: "Mikrofon wird geprüft …", className: "text-brand-700" },
  silent: {
    text: "Kein Ton zu hören. Ist das richtige Mikrofon ausgewählt und nicht stummgeschaltet?",
    className: "text-red-700",
  },
  quiet: { text: "Sehr leise. Bitte etwas lauter lesen oder näher ans Mikrofon gehen.", className: "text-amber-700" },
  good: { text: "Pegel gut, die Aufnahme läuft.", className: "text-green-800" },
};

// Live-Wellenform eines Mikrofon-Streams. onHeights bekommt alle Balken (fuer das Gesamtbild).
export function LiveWaveform({ stream, onHeights }: { stream: MediaStream; onHeights?: (heights: number[]) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [level, setLevel] = useState<Level>("wait");
  const onHeightsRef = useRef(onHeights);
  useEffect(() => {
    onHeightsRef.current = onHeights;
  }, [onHeights]);

  useEffect(() => {
    const AudioCtx =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const audio = new AudioCtx();
    // Safari startet den Kontext manchmal angehalten.
    void audio.resume();
    const source = audio.createMediaStreamSource(stream);
    const analyser = audio.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    const buffer = new Float32Array(analyser.fftSize);

    const heights: number[] = [];
    const recent: { at: number; rms: number }[] = [];
    const startedAt = performance.now();
    let lastSample = startedAt;

    // Fester Takt statt requestAnimationFrame: rAF steht still, wenn das Fenster im Hintergrund
    // ist. Wird auch der Takt gedrosselt, fuellen wir die verpassten Balken mit dem aktuellen
    // Pegel auf, damit die Wellenform zur Aufnahmedauer passt.
    const tick = () => {
      const now = performance.now();
      const steps = Math.min(40, Math.floor((now - lastSample) / SAMPLE_MS));
      if (steps < 1) return;
      lastSample += steps * SAMPLE_MS;
      analyser.getFloatTimeDomainData(buffer);
      let sum = 0;
      for (const v of buffer) sum += v * v;
      const rms = Math.sqrt(sum / buffer.length);
      for (let i = 0; i < steps; i++) heights.push(levelToHeight(rms));
      onHeightsRef.current?.(heights);

      recent.push({ at: now, rms });
      while (recent.length && now - recent[0].at > WINDOW_MS) recent.shift();
      if (now - startedAt > 1500) {
        const loudest = Math.max(...recent.map((r) => r.rms));
        setLevel(loudest < SILENT_RMS ? "silent" : loudest < QUIET_RMS ? "quiet" : "good");
      }
      if (canvasRef.current) drawBars(canvasRef.current, heights, "right");
    };
    const timer = setInterval(tick, SAMPLE_MS);

    return () => {
      clearInterval(timer);
      source.disconnect();
      void audio.close();
    };
  }, [stream]);

  const info = LEVEL_TEXT[level];
  return (
    <div className="space-y-1.5">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`block h-20 w-full border bg-brand-50 ${level === "silent" ? "border-red-400 text-red-700" : "border-brand-200 text-azure-800"}`}
      />
      <p role="status" aria-live="polite" className={`text-sm font-medium ${info.className}`}>
        {info.text}
      </p>
    </div>
  );
}

// Gesamtbild einer fertigen Aufnahme aus den gesammelten Balken.
export function WaveformBars({ heights }: { heights: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => drawBars(canvas, heights, "fit");
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [heights]);

  return <canvas ref={canvasRef} aria-hidden="true" className="block h-14 w-full border border-brand-200 bg-brand-50 text-azure-800" />;
}
