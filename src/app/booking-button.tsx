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
      ? "bg-brand-600 text-white hover:bg-brand-700"
      : "border border-brand-600 text-brand-700 hover:bg-brand-50";

  return (
    <a
      href={BOOKING_URL}
      target="_blank"
      rel="noreferrer"
      className={`inline-block rounded-md px-5 py-2.5 text-center font-medium transition ${styles} ${className}`}
    >
      {children}
    </a>
  );
}
