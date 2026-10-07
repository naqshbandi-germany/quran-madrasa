import { LegalText } from "@/components/legal-text";
import { OrnamentDivider } from "@/components/ornament";
import { DEFAULT_IMPRESSUM } from "@/lib/legal-defaults";
import { MINIATURES } from "@/lib/miniatures";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Impressum – Quran Madrasa" };

// Texte sind im Admin-Bereich pflegbar, daher bei jedem Aufruf frisch laden.
export const dynamic = "force-dynamic";

export default async function ImpressumPage() {
  const content = await prisma.siteContent.findUnique({ where: { id: "main" } });
  const text = content?.impressum.trim() || DEFAULT_IMPRESSUM;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-4xl font-semibold text-brand-900">Impressum</h1>
        <OrnamentDivider className="mt-3" />
      </section>
      <LegalText text={text} />

      <section className="max-w-3xl space-y-3 text-brand-900">
        <h2 className="pt-4 text-2xl font-semibold">Bildnachweis</h2>
        <p>
          Die abgebildeten Handschriften und Miniaturen sind Werke aus dem 9. bis 16. Jahrhundert,
          das Eck-Ornament ist gemeinfrei. Die Abbildungen stammen aus folgenden Quellen:
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {Object.values(MINIATURES).map((image) => (
            <li key={image.key}>
              {image.title} – {image.origin}, Lizenz: {image.license} (
              <a
                href={image.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Quelle
              </a>
              )
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
