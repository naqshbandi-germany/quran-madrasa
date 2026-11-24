import { Inter } from "next/font/google";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { EMAIL_TEMPLATES, TEACHER_EMAIL_KEYS } from "@/lib/email-defaults";
import { shortName } from "@/lib/names";
import { countUnreadNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { SITE_NAME } from "@/lib/site";
import { AppBreadcrumbs } from "./app-breadcrumbs";
import { AppNav, type NavGroup } from "./app-nav";
import "./app-theme.css";

// Serifenlose Schrift nur fuer den Verwaltungsbereich (auch fuer Ueberschriften).
const appFont = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-app" });

// Eigene App-Shell (feste Seitenleiste, Pfadleiste, sachliches Theme in app-theme.css) fuer
// Lehrer- und Admin-Bereich, getrennt vom oeffentlichen Seitenlayout in (site)/layout.tsx.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || (session.user.role !== "TEACHER" && session.user.role !== "ADMIN")) {
    redirect("/auth/signin");
  }
  const isAdmin = session.user.role === "ADMIN";
  const unread = await countUnreadNotifications(session.user.id);

  const navGroups: NavGroup[] = isAdmin
    ? [
        {
          title: "Verwaltung",
          links: [
            { href: "/admin", label: "Übersicht", icon: "grid" },
            { href: "/admin/benachrichtigungen", label: "Benachrichtigungen", icon: "bell", badge: unread },
            { href: "/teacher/kurse", label: "Kurse", icon: "book" },
            {
              label: "Personen",
              icon: "users",
              children: [
                { href: "/teacher/schueler", label: "Schüler" },
                { href: "/admin/lehrer", label: "Lehrer" },
                { href: "/admin/admins", label: "Admins" },
                { href: "/admin/konten", label: "Konten" },
              ],
            },
            { href: "/teacher/termine", label: "Termine", icon: "calendar" },
            { href: "/admin/emails", label: "E-Mail-Texte", icon: "template" },
          ],
        },
        {
          title: "Unterricht",
          links: [
            { href: "/teacher/mediathek", label: "Mediathek", icon: "library" },
            { href: "/teacher/emails", label: "E-Mails", icon: "mail" },
            { href: "/teacher/mailvorlagen", label: "Mailvorlagen", icon: "template" },
            { href: "/teacher/profil", label: "Mein Profil", icon: "users" },
          ],
        },
      ]
    : [
        {
          title: "Unterricht",
          links: [
            { href: "/teacher", label: "Übersicht", icon: "grid" },
            { href: "/teacher/benachrichtigungen", label: "Benachrichtigungen", icon: "bell", badge: unread },
            { href: "/teacher/kurse", label: "Kurse", icon: "book" },
            { href: "/teacher/schueler", label: "Schüler", icon: "student" },
            { href: "/teacher/termine", label: "Termine", icon: "calendar" },
            { href: "/teacher/mediathek", label: "Mediathek", icon: "library" },
            { href: "/teacher/emails", label: "E-Mails", icon: "mail" },
            { href: "/teacher/mailvorlagen", label: "Mailvorlagen", icon: "template" },
            { href: "/teacher/profil", label: "Mein Profil", icon: "users" },
          ],
        },
      ];

  // Namen fuer die Pfadleiste (Kurstitel, Bezeichnungen der E-Mail-Texte)
  const courses = await prisma.course.findMany({
    where: isAdmin ? {} : { teacherId: session.user.id },
    select: { id: true, title: true },
  });
  const crumbNames: Record<string, string> = Object.fromEntries([
    ...courses.map((c) => [`/teacher/courses/${c.id}`, c.title]),
    ...(isAdmin ? Object.entries(EMAIL_TEMPLATES).map(([key, t]) => [`/admin/emails/${key}`, t.label]) : []),
    ...TEACHER_EMAIL_KEYS.map((key) => [`/teacher/mailvorlagen/${key}`, EMAIL_TEMPLATES[key].label]),
  ]);

  return (
    <div className={`${appFont.variable} app-shell flex min-h-screen flex-col bg-brand-50 lg:flex-row`}>
      <AppNav
        siteName={SITE_NAME}
        areaLabel={isAdmin ? "Admin-Bereich" : "Lehrer-Bereich"}
        groups={navGroups}
        userName={session.user.name ? shortName({ name: session.user.name, muslimName: session.user.muslimName }) : ""}
        userRole={isAdmin ? "Administrator" : "Lehrkraft"}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 border-b border-brand-200 bg-white lg:sticky lg:top-0">
          <div className="mx-auto flex max-w-5xl items-center px-4 py-4 sm:px-8">
            <AppBreadcrumbs names={crumbNames} />
          </div>
        </header>

        <main className="flex-1 px-4 py-8 sm:px-8 sm:py-10">
          {/* Feste Maximalbreite: Zeilen bleiben kurz, Aktionen liegen nah am Text */}
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
