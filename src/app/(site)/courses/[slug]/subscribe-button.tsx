import Link from "next/link";

// Fuehrt zur Anmeldung des Kurses (Teilnehmer waehlen, dann Zahlung). Wer noch nicht
// angemeldet ist, wird dort zuerst zur Kontoerstellung gefuehrt. "query" traegt bei
// versteckten Kursen den Zugangscode weiter.
export function SubscribeButton({ slug, query = "" }: { slug: string; query?: string }) {
  return (
    <Link
      href={`/courses/${slug}/anmelden${query}`}
      className="btn-primary btn-display inline-block px-5 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700"
    >
      Jetzt anmelden
    </Link>
  );
}
