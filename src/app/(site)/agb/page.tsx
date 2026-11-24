import { LegalText } from "@/components/legal-text";
import { OrnamentDivider } from "@/components/ornament";
import { TERMS_TEXT } from "@/lib/terms-defaults";

export const metadata = { title: "Allgemeine Geschäftsbedingungen" };

export default function TermsPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-4xl font-semibold text-azure-800">Allgemeine Geschäftsbedingungen</h1>
        <OrnamentDivider className="mt-3" />
      </section>
      <LegalText text={TERMS_TEXT} />
    </div>
  );
}
