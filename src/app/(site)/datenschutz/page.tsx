import { LegalText } from "@/components/legal-text";
import { OrnamentDivider } from "@/components/ornament";
import { isZoomProvider } from "@/lib/classroom";
import { isGoogleAuthConfigured } from "@/lib/auth-providers";
import { defaultPrivacyPolicy } from "@/lib/legal-defaults";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Datenschutzerklärung – Quran Madrasa" };

// Texte sind im Admin-Bereich pflegbar, daher bei jedem Aufruf frisch laden.
export const dynamic = "force-dynamic";

export default async function PrivacyPolicyPage() {
  const content = await prisma.siteContent.findUnique({ where: { id: "main" } });
  const text = content?.privacyPolicy.trim() || defaultPrivacyPolicy(isZoomProvider(), isGoogleAuthConfigured());

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-4xl font-semibold text-brand-900">Datenschutzerklärung</h1>
        <OrnamentDivider className="mt-3" />
      </section>
      <LegalText text={text} />
    </div>
  );
}
