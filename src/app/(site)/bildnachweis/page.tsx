import Image from "next/image";

import { OrnamentDivider } from "@/components/ornament";
import { MINIATURES } from "@/lib/miniatures";

export const metadata = { title: "Bildnachweis – Quran Madrasa" };

export default function ImageCreditsPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold text-brand-700">Bildnachweis</h1>
        <OrnamentDivider className="mt-3" />
        <p className="mt-3 max-w-2xl text-brand-600">
          Die Handschriften und persischen Miniaturen auf dieser Seite sind Werke aus dem 9. bis 16.
          Jahrhundert, das Eck-Ornament ist gemeinfrei. Die Abbildungen stammen von Wikimedia
          Commons und aus dem Open-Access-Bestand des Metropolitan Museum of Art.
        </p>
      </section>

      <ul className="space-y-4">
        {Object.values(MINIATURES).map((miniature) => (
          <li
            key={miniature.key}
            className="flex gap-4 rounded-lg border border-brand-200 bg-white p-4"
          >
            <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-md border-2 border-gold-400">
              <Image
                src={miniature.src}
                alt={miniature.title}
                fill
                sizes="80px"
                className="object-cover"
                style={{ objectPosition: miniature.focus }}
              />
            </div>
            <div className="min-w-0 text-sm text-brand-900">
              <p className="font-serif text-base font-semibold text-brand-700">{miniature.title}</p>
              <p>{miniature.work}</p>
              <p className="text-brand-600">{miniature.origin}</p>
              <p className="text-brand-600">
                Lizenz: {miniature.license} ·{" "}
                <a
                  href={miniature.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  Quelle bei Wikimedia Commons
                </a>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
