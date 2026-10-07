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
