import { LegalText } from "@/components/legal-text";
import { OrnamentDivider } from "@/components/ornament";
import { WITHDRAWAL_TEXT } from "@/lib/terms-defaults";

export const metadata = { title: "Widerruf" };

export default function WithdrawalPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-4xl font-semibold text-azure-800">Widerruf</h1>
        <OrnamentDivider className="mt-3" />
      </section>
      <LegalText text={WITHDRAWAL_TEXT} />
    </div>
  );
}
