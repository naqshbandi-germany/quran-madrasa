// Silhouette eines nachdenklichen Mannes (Thawb und Kufi-Kappe) mit Fragezeichen ueber dem
// Kopf, fuer den Beratungs-Slide mit dem Labyrinth. Selbst gezeichnet, keine fremde Vorlage.
const FIGURE = "#f1e7cb";
const OUTLINE = "#0d2240";

// Arm als Linienzug: erst breit in Umrissfarbe, dann etwas schmaler in Figurenfarbe, damit
// er sich vom Koerper abhebt.
function Arm({ d }: { d: string }) {
  return (
    <>
      <path d={d} stroke={OUTLINE} strokeWidth="27" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} stroke={FIGURE} strokeWidth="21" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

export function ThinkingMan({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 430" className={className} fill="none" aria-hidden="true" focusable="false">
      {/* Fragezeichen */}
      <g fill="#ecdba8" fontFamily="var(--font-display), Georgia, serif" fontWeight="600">
        <text x="158" y="62" fontSize="66" transform="rotate(12 158 62)">?</text>
        <text x="208" y="122" fontSize="44" opacity="0.85" transform="rotate(-10 208 122)">?</text>
        <text x="30" y="96" fontSize="40" opacity="0.7" transform="rotate(-16 30 96)">?</text>
      </g>

      {/* Thawb */}
      <path
        d="M100 150 L140 150 C168 154 182 168 182 196 L188 396 C188 406 182 412 172 412 L68 412 C58 412 52 406 52 396 L58 196 C58 168 72 154 100 150 Z"
        fill={FIGURE}
      />
      {/* Hals und Kopf mit kurzem Bart */}
      <rect x="112" y="124" width="16" height="32" fill={FIGURE} />
      <path
        d="M94 100 C94 76 104 64 120 64 C136 64 146 76 146 100 C146 124 138 146 120 150 C102 146 94 124 94 100 Z"
        fill={FIGURE}
      />
      {/* Kufi-Kappe */}
      <path
        d="M92 88 C92 62 104 52 120 52 C136 52 148 62 148 88 Z"
        fill={FIGURE}
        stroke={OUTLINE}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />

      {/* Linker Arm haengt herab */}
      <Arm d="M70 186 L62 318" />
      {/* Rechter Arm: Oberarm nach unten, Unterarm hoch, Hand am Kinn */}
      <Arm d="M172 186 L182 262 L138 146" />
    </svg>
  );
}
