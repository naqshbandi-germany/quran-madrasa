// Schmale Zierleiste (Linie mit Raute und Punkten) als Trenner unter Ueberschriften.
export function OrnamentDivider({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 240 16"
      className={`h-4 w-48 text-gold-400 ${className}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M0 8 H98" stroke="currentColor" strokeWidth="1" />
      <path d="M142 8 H240" stroke="currentColor" strokeWidth="1" />
      <path d="M120 1 L127 8 L120 15 L113 8 Z" />
      <path d="M104 8 L108 4 L112 8 L108 12 Z" opacity="0.7" />
      <path d="M128 8 L132 4 L136 8 L132 12 Z" opacity="0.7" />
    </svg>
  );
}

// Dezentes Eck-Ornament (Doppelwinkel mit Raute); Standard = linke obere Ecke, Drehung
// per className (z. B. rotate-90).
export function CornerOrnament({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={`h-12 w-12 text-gold-400 sm:h-16 sm:w-16 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      aria-hidden="true"
    >
      <path d="M2 62 V16 Q2 2 16 2 H62" />
      <path d="M10 62 V24 Q10 10 24 10 H62" opacity="0.5" />
      <path d="M16 9 L23 16 L16 23 L9 16 Z" fill="currentColor" stroke="none" />
      <circle cx="34" cy="2" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="2" cy="34" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
