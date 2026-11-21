import { formatPrice } from "@/lib/course-labels";

type PricedCourse = { priceCents: number; currency: string; signupFeeCents: number | null };

// Preisangabe fuer Kursseite und Anmeldung: Monatsbeitrag und optional eine einmalige
// Anmeldegebuehr (z. B. symbolische 5 € in der Testphase bei 0 € pro Monat).
// family: Staffel des Familienpreises als Text, z. B. "1 Platz 25 €, 2 Plätze 45 €, ab 3 Plätzen 65 €".
export function priceSummary(course: PricedCourse, family?: string | null) {
  const fee = course.signupFeeCents && course.signupFeeCents > 0 ? course.signupFeeCents : null;
  const monthly = course.priceCents > 0 ? course.priceCents : 0;
  const feeText = fee ? formatPrice(fee, course.currency) : null;
  const monthlyText = formatPrice(monthly, course.currency);

  if (!fee && !monthly) return null;
  if (fee && !monthly) {
    return { headline: `${feeText} einmalig`, detail: "Danach fallen keine monatlichen Kosten an." };
  }
  if (fee) {
    return {
      headline: `${monthlyText} / Monat`,
      detail: `Zusätzlich einmalig ${feeText} bei der Anmeldung. Monatlich kündbar.`,
    };
  }
  if (family) {
    return {
      headline: `${monthlyText} / Monat`,
      detail: `Familienpreis für alle Kinderkurse zusammen: ${family}. Monatlich kündbar, keine Mindestlaufzeit.`,
    };
  }
  return { headline: `${monthlyText} / Monat`, detail: "Monatlich kündbar, keine Mindestlaufzeit" };
}
