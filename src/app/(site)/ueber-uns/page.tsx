import { BookingButton } from "@/components/booking-button";
import { prisma } from "@/lib/prisma";

export default async function AboutPage() {
  const siteContent = await prisma.siteContent.findUnique({ where: { id: "main" } });
  const missionStatement = siteContent?.missionStatement?.trim();

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-brand-700">Ziel & Zweck</h1>
      </section>

      {missionStatement ? (
        <div className="max-w-2xl space-y-4 whitespace-pre-line text-brand-900">
          {missionStatement}
        </div>
      ) : (
        <p className="max-w-2xl text-brand-600">
          Hier folgt in Kürze unser Statement of Purpose. Unser Ziel: hochwertigen
          Koran-Unterricht kostengünstig und für jeden zugänglich zu machen.
        </p>
      )}

      <div className="rounded-lg border border-brand-200 bg-brand-50 p-5 text-center">
        <p className="mb-3 text-brand-700">Neugierig geworden? Lernt uns in einem kostenlosen Gespräch kennen.</p>
        <BookingButton />
      </div>
    </div>
  );
}
