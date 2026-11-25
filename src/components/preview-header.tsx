import Link from "next/link";

import { UserMenu } from "@/app/(site)/user-menu";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// Schlichte Kopfzeile im Vorschau-Modus: nur Name und Benutzermenue, keine Navigation zu Seiten,
// die noch nicht oeffentlich sind.
export function PreviewHeader({ maxWidth }: { maxWidth: "max-w-3xl" | "max-w-5xl" }) {
  return (
    <div className={`mx-auto flex ${maxWidth} items-center justify-between gap-4 px-4 py-3`}>
      <Link href="/" className="flex flex-col leading-tight">
        <span className="font-display text-xl font-semibold uppercase tracking-[0.16em] text-azure-800 sm:text-2xl">
          {SITE_NAME}
        </span>
        <span className="text-xs tracking-[0.08em] text-brand-700">{SITE_TAGLINE}</span>
      </Link>
      <UserMenu />
    </div>
  );
}
