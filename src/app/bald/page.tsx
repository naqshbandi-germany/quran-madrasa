import type { Metadata } from "next";
import Link from "next/link";

import { priceSummary } from "@/lib/course-pricing";
import { prisma } from "@/lib/prisma";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";
import { OPERATOR } from "@/lib/terms-defaults";

// Oeffentliche Infoseite, solange die Website im Vorschau-Modus ist (siehe src/proxy.ts): Angebot,
// Preise, Ablauf, Kuendigung, Traeger und Kontakt. Preise kommen aus den veroeffentlichten Kursen.
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} – ${SITE_TAGLINE}` },
  description: "Online-Unterricht in Quran-Rezitation und islamischen Wissenschaften, live in kleinen Gruppen.",
  robots: { index: false, follow: false },
};

// Die Seite soll auch ohne Datenbank erscheinen, dann ohne Kursliste.
async function loadCourses() {
  try {
    return await prisma.course.findMany({
      where: { isPublished: true, isHidden: false },
      orderBy: { title: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        priceCents: true,
        currency: true,
        signupFeeCents: true,
      },
    });
  } catch (err) {
    console.error("Infoseite: Kurse konnten nicht geladen werden:", err);
    return [];
  }
}

// Preise zum Start (Entscheidung des Vereins, Nov. 2026). Verbindlich ist der Preis vor der Zahlung.
const PRICES = [
  { label: "Erwachsene", price: "35 € im Monat", detail: "pro Person und Kurs" },
  { label: "Kinder, ein Kursplatz", price: "25 € im Monat", detail: "ein Kind in einem Kurs" },
  { label: "Kinder, zwei Kursplätze", price: "45 € im Monat", detail: "zusammen pro Familie" },
  { label: "Kinder, ab drei Kursplätzen", price: "65 € im Monat", detail: "zusammen pro Familie, mehr wird es nicht" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold text-azure-800">{title}</h2>
      {children}
    </section>
  );
}

export default async function InfoPage() {
  const courses = await loadCourses();

  return (
    <>
      <header className="border-b border-gold-400/40 bg-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-2xl font-semibold text-azure-800">{SITE_NAME}</p>
            <p className="text-sm text-brand-700">{SITE_TAGLINE}</p>
          </div>
          <Link href="/auth/signin" className="text-sm font-medium text-azure-800 underline">
            Anmelden
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-10 px-4 py-10 text-brand-900">
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold leading-tight text-azure-800">
            Quran und Islam online lernen, live und in kleinen Gruppen
          </h1>
          <p>
            Wir unterrichten Quran-Rezitation und islamische Wissenschaften für Kinder, Jugendliche und Erwachsene. Der
            Unterricht findet zu festen Zeiten per Zoom statt, mit einer Lehrkraft, die dich kennt.{" "}
            <Link href="/lehrer" className="font-medium text-azure-800 underline">
              Unsere Lehrer
            </Link>
          </p>
          <p className="border-l-2 border-gold-400 bg-brand-50 px-4 py-3 text-sm">
            Zurzeit läuft eine Testphase auf Einladung. Die allgemeine Anmeldung öffnet in Kürze. Fragen beantworten wir
            gern unter{" "}
            <a href={`mailto:${OPERATOR.email}`} className="font-medium text-azure-800 underline">
              {OPERATOR.email}
            </a>
            .
          </p>
        </div>

        {courses.length > 0 && (
          <Section title="Unsere Kurse">
            <ul className="divide-y divide-brand-200 border border-brand-200 bg-white">
              {courses.map((course) => {
                const price = priceSummary(course);
                return (
                  <li key={course.id} className="space-y-1 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                      <h3 className="font-semibold text-azure-800">{course.title}</h3>
                      {price && <p className="text-sm font-medium">{price.headline}</p>}
                    </div>
                    <p className="text-sm">{course.description}</p>
                    {price && <p className="text-xs text-brand-700">{price.detail}</p>}
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        <Section title="Preise zum Start">
          <ul className="divide-y divide-brand-200 border border-brand-200 bg-white">
            {PRICES.map((p) => (
              <li key={p.label} className="flex flex-wrap items-baseline justify-between gap-x-4 p-4">
                <span>
                  <span className="font-medium">{p.label}</span>{" "}
                  <span className="text-sm text-brand-700">({p.detail})</span>
                </span>
                <span className="font-semibold text-azure-800">{p.price}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-brand-700">
            Monatlich kündbar. Verbindlich ist immer der Preis, der vor der Zahlung angezeigt wird; in der Testphase
            können andere Preise gelten.
          </p>
        </Section>

        <Section title="So läuft es ab">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Du legst ein Konto an und meldest dich, dein Kind oder eine andere Person zu einem Kurs an.</li>
            <li>Du bezahlst sicher über Stripe. Vor der Zahlung siehst du den vollständigen Preis.</li>
            <li>Du bekommst eine Bestätigung per E-Mail, siehst alle Termine in deinem Konto und wirst vorher erinnert.</li>
            <li>Zum Unterricht kommst du über einen persönlichen Link, Lernmaterial erhältst du per E-Mail.</li>
          </ol>
        </Section>

        <Section title="Zahlung, Kündigung und Erstattung">
          <p>
            Je nach Kurs fallen eine einmalige Anmeldegebühr, ein monatlicher Beitrag oder beides an. Es gibt keine
            Mindestlaufzeit: Du kündigst jederzeit zum Ende des Abrechnungsmonats, online unter „Abo verwalten“ oder per
            E-Mail. Nach der Anmeldung hast du ein 14-tägiges Widerrufsrecht, Erstattungen gehen auf deine Zahlungsart
            zurück. Mehr dazu in den{" "}
            <Link href="/agb" className="font-medium text-azure-800 underline">
              AGB
            </Link>{" "}
            und unter{" "}
            <Link href="/widerruf" className="font-medium text-azure-800 underline">
              Widerruf
            </Link>
            .
          </p>
        </Section>

        <Section title="Träger und Kontakt">
          <p>
            {OPERATOR.name}
            <br />
            {OPERATOR.address}
            <br />
            E-Mail:{" "}
            <a href={`mailto:${OPERATOR.email}`} className="font-medium text-azure-800 underline">
              {OPERATOR.email}
            </a>
            <br />
            Telefon: {OPERATOR.phone}
          </p>
        </Section>
      </main>

      <footer className="border-t border-brand-200 py-6 text-sm text-brand-700">
        <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 px-4" aria-label="Rechtliches">
          {[
            ["/kontakt", "Kontakt"],
            ["/agb", "AGB"],
            ["/widerruf", "Widerruf"],
            ["/impressum", "Impressum"],
            ["/datenschutz", "Datenschutz"],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="underline underline-offset-2 hover:text-brand-600">
              {label}
            </Link>
          ))}
        </nav>
      </footer>
    </>
  );
}
