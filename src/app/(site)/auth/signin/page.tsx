import { Suspense } from "react";

import { isGoogleAuthConfigured } from "@/lib/auth-providers";
import { SignInForm } from "./signin-form";

export const metadata = { title: "Anmelden – Quran Madrasa" };

// Ob die Google-Anmeldung angeboten wird, haengt von Umgebungsvariablen ab.
export const dynamic = "force-dynamic";

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm googleEnabled={isGoogleAuthConfigured()} />
    </Suspense>
  );
}
