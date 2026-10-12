const BOOKING_URL = process.env.NEXT_PUBLIC_BOOKING_URL;

// Wird automatisch ausgeblendet, solange keine Buchungsseite (z.B. Cal.com)
// hinterlegt ist (NEXT_PUBLIC_BOOKING_URL) - dann lieber gar kein Button als ein
// kaputter Link.
export function BookingButton({
  variant = "primary",
  className = "",
  children = "Kostenlose Erstberatung buchen",
}: {
  variant?: "primary" | "secondary";
  className?: string;
  children?: React.ReactNode;
}) {
  if (!BOOKING_URL) return null;

  const styles =
    variant === "primary"
      ? "btn-primary btn-display"
      : "border border-brass text-brand-700 hover:bg-brand-50";

  return (
    <a
      href={BOOKING_URL}
      target="_blank"
      rel="noreferrer"
      className={`px-6 py-3 ${variant === "primary" ? "" : "inline-block font-medium transition"} ${styles} ${className}`}
    >
      {children}
    </a>
  );
}
