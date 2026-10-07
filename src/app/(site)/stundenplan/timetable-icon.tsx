import { ICONS, type IconName } from "@/lib/timetable-art";

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
