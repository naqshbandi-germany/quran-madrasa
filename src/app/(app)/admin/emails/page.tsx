import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EMAIL_GROUPS, EMAIL_TEMPLATES, type EmailTemplateKey } from "@/lib/email-defaults";
import { prisma } from "@/lib/prisma";
import { formatGermanDateTime } from "@/lib/schedule-time";

export const dynamic = "force-dynamic";

// Uebersicht aller automatisch verschickten E-Mails; die Texte lassen sich pro Mail anpassen.
export default async function EmailTemplatesPage() {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const stored = await prisma.emailTemplate.findMany({ select: { key: true, updatedAt: true } });
  const changedAt = new Map(stored.map((t) => [t.key, t.updatedAt]));
  const keys = Object.keys(EMAIL_TEMPLATES) as EmailTemplateKey[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-azure-800">E-Mail-Texte</h1>
        <p className="mt-2 text-sm text-brand-700">
          Diese E-Mails verschickt die Website automatisch. Betreff und Text lassen sich anpassen;
          Platzhalter wie {"{{name}}"} werden beim Versand durch die passenden Angaben ersetzt. Ist
          nichts angepasst, gilt der Standardtext.
        </p>
      </div>

      {EMAIL_GROUPS.map((group) => (
        <section key={group} className="border border-gold-400/40 bg-white p-5">
          <h2 className="mb-3 font-semibold text-azure-800">{group}</h2>
          <ul className="divide-y divide-brand-100">
            {keys
              .filter((key) => EMAIL_TEMPLATES[key].group === group)
              .map((key) => {
                const template = EMAIL_TEMPLATES[key];
                const changed = changedAt.get(key);
                return (
                  <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/admin/emails/${key}`} className="font-medium text-brand-900 underline">
                        {template.label}
                      </Link>
                      <p className="text-brand-600">{template.description}</p>
                    </div>
                    <span
                      className={`shrink-0 px-2 py-0.5 text-xs ${
                        changed ? "bg-gold-400/20 text-brand-900" : "bg-brand-50 text-brand-700"
                      }`}
                    >
                      {changed ? `angepasst am ${formatGermanDateTime(changed)}` : "Standardtext"}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
