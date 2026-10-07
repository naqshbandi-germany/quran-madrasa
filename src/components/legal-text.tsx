// Einfache Darstellung fuer Rechtstexte: Absaetze durch Leerzeilen getrennt, Absaetze
// mit "## " am Anfang werden zu Zwischenueberschriften.
export function LegalText({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="max-w-3xl space-y-3 text-brand-900">
      {paragraphs.map((paragraph, i) =>
        paragraph.startsWith("## ") ? (
          <h2 key={i} className="pt-4 text-2xl font-semibold text-brand-900">
            {paragraph.slice(3)}
          </h2>
        ) : (
          <p key={i} className="whitespace-pre-line leading-relaxed">
            {paragraph}
          </p>
        ),
      )}
    </div>
  );
}
