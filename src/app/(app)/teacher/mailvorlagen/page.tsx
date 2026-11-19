import Link from "next/link";

import { auth } from "@/auth";
import { EMAIL_TEMPLATES, TEACHER_EMAIL_KEYS } from "@/lib/email-defaults";
import { prisma } from "@/lib/prisma";
import { formatZonedDateTime } from "@/lib/schedule-time";
import { resolveViewTimeZone } from "@/lib/view-time-zone";

export const metadata = { title: "Mailvorlagen" };
export const dynamic = "force-dynamic";

// Eigene Vorlagen der Lehrkraft fuer die Mails, die sie selbst ausloest (Einladungen, Absagen,
// Hoerprobe usw.). Ohne eigene Vorlage gilt der allgemeine Text aus dem Admin-Bereich.
export default async function TeacherEmailTemplatesPage() {
  const session = await auth();
  if (!session) return null;

  const [own, { timeZone }] = await Promise.all([
    prisma.teacherEmailTemplate.findMany({
      where: { userId: session.user.id },
      select: { key: true, updatedAt: true },
    }),
    resolveViewTimeZone(session.user.id),
  ]);
  const changedAt = new Map(own.map((t) => [t.key, t.updatedAt]));

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-azure-800">Mailvorlagen</h1>
        <p className="mt-2 text-sm text-brand-700">
          Diese E-Mails gehen in deinem Namen an Schüler und Gäste. Du kannst für jede Mail deine eigene Vorlage
          speichern; Platzhalter wie {"{{name}}"} werden beim Versand für jeden Empfänger ersetzt. Ohne eigene Vorlage
          gilt der allgemeine Text. Beim Einladen, beim Absagen einer Probestunde und beim Anfordern einer Hörprobe
          siehst du die Mail außerdem vorher und kannst sie nur für diesen Versand ändern.
        </p>
      </div>

      <section className="border border-gold-400/40 bg-white p-5">
        <ul className="divide-y divide-brand-100">
          {TEACHER_EMAIL_KEYS.map((key) => {
            const template = EMAIL_TEMPLATES[key];
            const changed = changedAt.get(key);
            return (
              <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0">
                  <Link href={`/teacher/mailvorlagen/${key}`} className="font-medium text-brand-900 underline">
                    {template.label}
                  </Link>
                  <p className="text-brand-600">{template.description}</p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 text-xs ${
                    changed ? "bg-gold-400/20 text-brand-900" : "bg-brand-50 text-brand-700"
                  }`}
                >
                  {changed ? `eigene Vorlage vom ${formatZonedDateTime(changed, timeZone)} Uhr` : "allgemeiner Text"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
