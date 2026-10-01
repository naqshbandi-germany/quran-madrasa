import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppSignOutButton } from "./app-sign-out-button";

// Eigene App-Shell (Sidebar statt Marketing-Nav) fuer Lehrer- und Admin-Bereich,
// getrennt vom oeffentlichen Seitenlayout in (site)/layout.tsx - siehe README.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    redirect("/auth/signin");
  }

  const navLinks = [
    session.user.role === "TEACHER" && { href: "/teacher", label: "Meine Kurse" },
    session.user.role === "ADMIN" && { href: "/admin", label: "Admin-Bereich" },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-brand-200 bg-white sm:min-h-screen sm:w-60 sm:border-b-0 sm:border-r">
        <div className="px-4 py-4">
          <Link href="/" className="text-lg font-semibold text-brand-700">
            Quran Madrasa
          </Link>
          <p className="text-xs text-brand-600">Verwaltung</p>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 text-sm sm:flex-col sm:overflow-visible sm:pb-0">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="shrink-0 rounded-md px-3 py-2 font-medium text-brand-700 hover:bg-brand-50"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-2 border-t border-brand-100 px-4 py-4 text-sm sm:mt-auto">
          <p className="text-brand-600">{session.user.name}</p>
          <div className="mt-1 flex items-center gap-3">
            <Link href="/" className="text-brand-700 underline">
              Zur Webseite
            </Link>
            <AppSignOutButton />
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
