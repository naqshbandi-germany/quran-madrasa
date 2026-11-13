import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EmailTemplateEditor } from "@/components/email-template-editor";
import { EMAIL_TEMPLATES, isEmailTemplateKey } from "@/lib/email-defaults";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EmailTemplatePage({ params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const { key } = await params;
  if (!isEmailTemplateKey(key)) notFound();
  const template = EMAIL_TEMPLATES[key];
  const stored = await prisma.emailTemplate.findUnique({ where: { key } });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/emails" className="text-sm text-brand-700 underline">
          ← Alle E-Mail-Texte
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-azure-800">{template.label}</h1>
        <p className="mt-1 text-sm text-brand-700">{template.description}</p>
      </div>

      <EmailTemplateEditor
        templateKey={key}
        hasButton={template.hasButton}
        placeholders={template.placeholders.map((p) => ({ key: p.key, label: p.label, html: "html" in p && p.html }))}
        defaults={template.defaults}
        initial={
          stored
            ? { subject: stored.subject, body: stored.body, buttonLabel: stored.buttonLabel, footer: stored.footer }
            : template.defaults
        }
        isCustom={Boolean(stored)}
      />
    </div>
  );
}
