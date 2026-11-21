// Rechnen mit der Staffel des Familienpreises (siehe family-pricing.ts). Wird auch im Browser
// verwendet und darf deshalb nichts Serverseitiges importieren.

export type FamilyTier = { upTo: number | null; unitCents: number; flatCents: number };

// Gesamtbetrag fuer eine Anzahl Plaetze (gestaffelt: jede Stufe gilt nur fuer ihre Plaetze).
export function familyTotalCents(tiers: FamilyTier[], quantity: number) {
  let total = 0;
  let from = 0;
  for (const tier of tiers) {
    if (quantity <= from) break;
    const to = tier.upTo ?? Infinity;
    const units = Math.min(quantity, to) - from;
    if (units > 0) total += units * tier.unitCents + tier.flatCents;
    from = to;
  }
  return total;
}

// Kurzer Text zur Staffel, z. B. "1 Platz 25 €, 2 Plätze 45 €, ab 3 Plätzen 65 €".
// Ohne Deckel: die ersten drei Stufen und "jeder weitere Platz X €".
export function familyTierSummary(tiers: FamilyTier[], format: (cents: number) => string) {
  const label = (n: number) => `${n} ${n === 1 ? "Platz" : "Plätze"}`;
  const parts: string[] = [];
  for (let n = 1; n <= 5; n++) {
    const total = familyTotalCents(tiers, n);
    if (familyTotalCents(tiers, n + 1) === total) {
      parts.push(n === 1 ? `${label(1)} ${format(total)}` : `ab ${n} Plätzen ${format(total)}`);
      return parts.join(", ");
    }
    if (n === 3) {
      parts.push(`${label(3)} ${format(total)}`, `jeder weitere ${format(familyTotalCents(tiers, 4) - total)}`);
      return parts.join(", ");
    }
    parts.push(`${label(n)} ${format(total)}`);
  }
  return parts.join(", ");
}
