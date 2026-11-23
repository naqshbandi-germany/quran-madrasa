import { Suspense } from "react";

import { isGoogleAuthConfigured } from "@/lib/auth-providers";
import { findValidInvitation } from "@/lib/invitations";
import { SignUpForm } from "./signup-form";

export const metadata = { title: "Konto erstellen" };

// Ob die Google-Anmeldung angeboten wird, haengt von Umgebungsvariablen ab.
export const dynamic = "force-dynamic";

// Wer ueber eine Einladung kommt, bekommt die eingeladene Adresse vorausgefuellt (ueber das Token,
// damit sie nicht in der URL steht).
async function invitedEmail(callbackUrl: string | string[] | undefined) {
  const token = typeof callbackUrl === "string" ? /^\/einladung\/([A-Za-z0-9_-]+)$/.exec(callbackUrl)?.[1] : null;
  return token ? ((await findValidInvitation(token))?.email ?? "") : "";
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const initialEmail = await invitedEmail((await searchParams).callbackUrl);
  return (
    <Suspense>
      <SignUpForm googleEnabled={isGoogleAuthConfigured()} initialEmail={initialEmail} />
    </Suspense>
  );
}
