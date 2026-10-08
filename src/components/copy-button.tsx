"use client";

import { useEffect, useRef, useState } from "react";

import { CheckIcon, CopyIcon } from "@/components/icons";

// Kopiert einen Text in die Zwischenablage und bestaetigt es kurz ("Kopiert"). Funktioniert
// auch ohne Clipboard-API (Fallback ueber ein verstecktes Textfeld).
export function CopyButton({
  text,
  label = "Kopieren",
  ariaLabel,
  className = "",
}: {
  text: string;
  label?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-azure-800 transition hover:bg-azure-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-azure-700 ${className}`}
    >
      {copied ? <CheckIcon className="h-4 w-4 text-green-700" /> : <CopyIcon />}
      <span aria-live="polite">{copied ? "Kopiert" : label}</span>
    </button>
  );
}
