import {
  ICONS,
  SKYLINE_COLOR,
  SKYLINE_LEFT,
  SKYLINE_RIGHT,
  SKYLINE_SIZE,
  type IconName,
} from "@/lib/timetable-art";

export function TimetableIcon({
  name,
  color,
  background,
  className,
}: {
  name: IconName;
  color: string;
  background: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {ICONS[name].map((part, i) => {
        const tone = part.tone === "main" ? color : background;
        return part.mode === "fill" ? (
          <path key={i} d={part.d} fill={tone} />
        ) : (
          <path
            key={i}
            d={part.d}
            fill="none"
            stroke={tone}
            strokeWidth={part.width ?? 1}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export function Skyline({ side, className }: { side: "left" | "right"; className?: string }) {
  const parts = side === "left" ? SKYLINE_LEFT : SKYLINE_RIGHT;
  return (
    <svg
      viewBox={`0 0 ${SKYLINE_SIZE.width} ${SKYLINE_SIZE.height}`}
      className={className}
      aria-hidden="true"
    >
      {parts.map((d, i) => (
        <path key={i} d={d} fill={SKYLINE_COLOR} />
      ))}
    </svg>
  );
}
