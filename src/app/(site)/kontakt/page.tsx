import { OrnamentDivider } from "@/components/ornament";
import { SITE_NAME } from "@/lib/site";
import { OPERATOR } from "@/lib/terms-defaults";

export const metadata = { title: "Kontakt" };

export default function ContactPage() {
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-4xl font-semibold text-azure-800">Kontakt</h1>
        <OrnamentDivider className="mt-3" />
      </section>
      <div className="max-w-3xl space-y-3 text-brand-900">
        <p>Fragen zu Kursen, Anmeldung, Zahlung oder Kündigung? Schreib uns oder ruf an.</p>
        <p>
          {SITE_NAME} ist ein Angebot des
          <br />
          {OPERATOR.name}
          <br />
          {OPERATOR.address}
        </p>
        <p>
          E-Mail:{" "}
          <a href={`mailto:${OPERATOR.email}`} className="font-medium text-azure-800 underline">
            {OPERATOR.email}
          </a>
          <br />
          Telefon:{" "}
          <a href={`tel:+49${OPERATOR.phone.replace(/\D/g, "").slice(1)}`} className="font-medium text-azure-800 underline">
            {OPERATOR.phone}
          </a>
        </p>
      </div>
    </div>
  );
}
