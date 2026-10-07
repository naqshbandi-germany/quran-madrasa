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

// Feingliedriges Eck-Ornament (Doppellinie mit Punktreihe, Rosette und Ranken); Standard =
// linke obere Ecke, die Linien laufen buendig an den Kanten entlang. Drehung per className
// (z. B. rotate-90).
export function CornerOrnament({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 128"
      className={`h-16 w-16 text-gold-400 sm:h-32 sm:w-32 ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Aussen- und Innenlinie mit Punktreihe dazwischen */}
      <path d="M1 127 V38 Q1 1 38 1 H127" strokeWidth="1.5" />
      <path d="M10 127 V42 Q10 10 42 10 H127" strokeWidth="0.8" opacity="0.7" />
      <path d="M5.5 127 V40 Q5.5 5.5 40 5.5 H127" strokeWidth="1.5" strokeDasharray="0.1 7" opacity="0.75" />

      {/* Rosette in der Ecke */}
      <g transform="translate(30 30)">
        <circle r="14" strokeWidth="0.8" />
        <circle r="10" strokeWidth="0.5" opacity="0.6" />
        <path
          d="M0 -12 L3.2 -3.2 L12 0 L3.2 3.2 L0 12 L-3.2 3.2 L-12 0 L-3.2 -3.2 Z"
          fill="currentColor"
          stroke="none"
        />
        <path d="M-8.5 -8.5 L8.5 8.5 M8.5 -8.5 L-8.5 8.5" strokeWidth="0.6" opacity="0.7" />
        <circle r="2" strokeWidth="0.8" />
      </g>

      {/* Ranken mit Spirale, die von der Rosette an den Kanten entlang laufen */}
      <path d="M46 30 C58 30 60 19 71 22 C79 24 78 34 70 33 C64 32 65 26 70 27" strokeWidth="1.1" />
      <path d="M30 46 C30 58 19 60 22 71 C24 79 34 78 33 70 C32 64 26 65 27 70" strokeWidth="1.1" />

      {/* Blaetter und fortlaufende Ranke */}
      <path d="M82 25 C88 15 99 17 101 23 C95 28 88 29 82 25 Z" fill="currentColor" stroke="none" opacity="0.85" />
      <path d="M25 82 C15 88 17 99 23 101 C28 95 29 88 25 82 Z" fill="currentColor" stroke="none" opacity="0.85" />
      <path d="M104 27 C111 27 113 21 121 23" strokeWidth="0.9" opacity="0.8" />
      <path d="M27 104 C27 111 21 113 23 121" strokeWidth="0.9" opacity="0.8" />
      <circle cx="115" cy="31" r="1.4" fill="currentColor" stroke="none" opacity="0.8" />
      <circle cx="31" cy="115" r="1.4" fill="currentColor" stroke="none" opacity="0.8" />
    </svg>
  );
}
