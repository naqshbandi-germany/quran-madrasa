import { Suspense } from "react";

import { isGoogleAuthConfigured } from "@/lib/auth-providers";
import { SignUpForm } from "./signup-form";

export const metadata = { title: "Konto erstellen – Quran Madrasa" };

// Ob die Google-Anmeldung angeboten wird, haengt von Umgebungsvariablen ab.
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm googleEnabled={isGoogleAuthConfigured()} />
    </Suspense>
  );
}
