import type { Metadata } from "next";
import Link from "next/link";

import { findEmailChange } from "@/lib/email-change";
import { ConfirmEmailForm } from "./confirm-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "E-Mail-Adresse bestätigen", robots: { index: false, follow: false } };

// Bestaetigung per Knopf statt beim Aufruf: E-Mail-Programme oeffnen Links teils automatisch.
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const value = typeof token === "string" ? token : "";
  const record = await findEmailChange(value);

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-3xl font-semibold text-azure-800">E-Mail-Adresse bestätigen</h1>
      <ConfirmEmailForm
        token={value}
        change={record ? { oldEmail: record.user.email, newEmail: record.newEmail } : null}
      />
      {!record && (
        <p className="text-brand-900/85">
          Einen neuen Link bekommst du unter{" "}
          <Link href="/konto" className="font-medium text-azure-800 underline">
            Mein Konto
          </Link>
          .
        </p>
      )}
    </div>
  );
}
