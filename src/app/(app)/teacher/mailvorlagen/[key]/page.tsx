import Link from "next/link";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { EmailTemplateEditor } from "@/components/email-template-editor";
import { EMAIL_TEMPLATES, isTeacherEmailKey } from "@/lib/email-defaults";
import { editableEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

// Eigene Vorlage einer Mail bearbeiten (mit Vorschau und Testmail an sich selbst).
export default async function TeacherEmailTemplatePage({ params }: { params: Promise<{ key: string }> }) {
  const session = await auth();
  if (!session) return null;

  const { key } = await params;
  if (!isTeacherEmailKey(key)) notFound();
  const template = EMAIL_TEMPLATES[key];
  const { content, standard, isOwn } = await editableEmail(key, session.user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-azure-800">{template.label}</h1>
        <p className="mt-1 text-sm text-brand-700">{template.description}</p>
      </div>

      <EmailTemplateEditor
        scope="teacher"
        templateKey={key}
        hasButton={template.hasButton}
        placeholders={template.placeholders.map((p) => ({ key: p.key, label: p.label, html: "html" in p && p.html }))}
        defaults={standard}
        initial={content}
        isCustom={isOwn}
      />

      <Link href="/teacher/mailvorlagen" className="inline-block text-sm font-medium text-brand-700 underline">
        Zurück zu den Mailvorlagen
      </Link>
    </div>
  );
}
