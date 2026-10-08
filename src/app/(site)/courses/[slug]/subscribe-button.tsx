import Link from "next/link";

// Fuehrt zur Anmeldung des Kurses (Teilnehmer waehlen, dann Zahlung). Wer noch nicht
// angemeldet ist, wird dort zuerst zur Kontoerstellung gefuehrt.
export function SubscribeButton({ slug }: { slug: string }) {
  return (
    <Link
      href={`/courses/${slug}/anmelden`}
      className="inline-block rounded-md bg-brand-600 px-5 py-2.5 font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700"
    >
      Jetzt anmelden
    </Link>
  );
}
