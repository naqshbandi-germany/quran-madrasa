"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

type Role = "STUDENT" | "TEACHER" | "ADMIN";

type MenuLink = { href: string; label: string; description?: string };

const ROLE_LABELS: Record<Role, string> = {
  STUDENT: "Teilnehmer-Konto",
  TEACHER: "Lehrer",
  ADMIN: "Administrator",
};

function menuLinksFor(role: Role): MenuLink[] {
  const links: MenuLink[] = [
    { href: "/dashboard", label: "Meine Kurse", description: "Termine und Zugang zum Unterricht" },
    { href: "/dashboard/billing", label: "Abo verwalten", description: "Zahlung und Kündigung" },
  ];
  if (role === "TEACHER") {
    links.push({ href: "/teacher", label: "Lehrerbereich", description: "Kurse, Termine, Teilnehmer" });
  }
  if (role === "ADMIN") {
    links.push({ href: "/admin", label: "Admin-Bereich", description: "Kurse, Lehrer, Texte" });
  }
  return links;
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

function Avatar({ name, image, size = "h-9 w-9" }: { name: string; image?: string | null; size?: string }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full bg-azure-800 text-sm font-semibold text-white`}
    >
      {initialsOf(name)}
    </span>
  );
}

const ITEM_STYLE =
  "block rounded-md px-3 py-2 text-brand-900 transition hover:bg-brand-100 hover:text-azure-700 focus-visible:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-azure-700";

// Benutzermenue rechts in der Kopfzeile: Avatar und Name, darunter ein Aufklappmenue mit den
// Konto-Bereichen und "Abmelden". Ohne Anmeldung steht dort nur "Anmelden". Mit
// `inline` (mobiles Menue) wird der Inhalt ohne Aufklappen direkt untereinander gezeigt.
export function UserMenu({ inline = false }: { inline?: boolean }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const open = openOnPath === pathname;
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  // Schliessen per Klick ausserhalb und Escape (Fokus zurueck auf den Schalter)
  useEffect(() => {
    if (!open || inline) return;
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpenOnPath(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenOnPath(null);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, inline]);

  if (status === "loading") return null;

  if (!session) {
    return (
      <Link
        href="/auth/signin"
        className={
          inline
            ? "rounded-md px-2 py-2.5 text-brand-900 hover:bg-brand-100 hover:text-azure-700"
            : "rounded-md border border-azure-800 px-4 py-1.5 font-medium text-azure-800 transition hover:bg-azure-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700"
        }
      >
        Anmelden
      </Link>
    );
  }

  const { name, email, image, role } = session.user;
  const links = menuLinksFor(role);
  const displayName = name || email || "Konto";

  const content = (
    <>
      <div className="flex items-center gap-3 px-3 py-3">
        <Avatar name={displayName} image={image} size="h-11 w-11" />
        <div className="min-w-0">
          <p className="truncate font-semibold text-brand-900">{displayName}</p>
          <p className="truncate text-xs text-brand-900/70">{email}</p>
          <p className="mt-0.5 text-xs text-azure-800">{ROLE_LABELS[role]}</p>
        </div>
      </div>
      <ul className="border-t border-brand-100 p-1.5" role={inline ? undefined : "none"}>
        {links.map((link) => (
          <li key={link.href} role={inline ? undefined : "none"}>
            <Link href={link.href} role={inline ? undefined : "menuitem"} className={ITEM_STYLE}>
              <span className="block font-medium">{link.label}</span>
              {link.description && (
                <span className="block text-xs text-brand-900/65">{link.description}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-brand-100 p-1.5">
        <button
          type="button"
          role={inline ? undefined : "menuitem"}
          onClick={() => signOut({ callbackUrl: "/" })}
          className={`${ITEM_STYLE} w-full text-left font-medium`}
        >
          Abmelden
        </button>
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="mt-2 rounded-lg border border-brand-200 bg-white" aria-label="Benutzermenü">
        {content}
      </div>
    );
  }

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next].focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpenOnPath(open ? null : pathname)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpenOnPath(pathname);
          }
        }}
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-brand-900 transition hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azure-700"
      >
        <Avatar name={displayName} image={image} />
        <span className="hidden max-w-[9rem] truncate text-sm font-medium xl:inline">{displayName}</span>
        <span className="sr-only xl:hidden">Benutzermenü, {displayName}</span>
        <svg viewBox="0 0 12 12" className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" />
        </svg>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Benutzermenü"
          onKeyDown={onMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-lg border border-brand-200 bg-white shadow-lg"
        >
          {content}
        </div>
      )}
    </div>
  );
}
