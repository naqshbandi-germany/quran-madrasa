import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { enrollPathForInvitation, findValidInvitation, invitationPath, shortenEmail } from "@/lib/invitations";
import { normalizeEmail } from "@/lib/invitees";
import { callName } from "@/lib/names";
import { prisma } from "@/lib/prisma";
import { SwitchAccountButton } from "./switch-account-button";

// Persoenlicher Einladungslink zu einem Kurs. Nicht zwischenspeichern und nicht indexieren.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Einladung", robots: { index: false, follow: false } };

export default async function InvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await findValidInvitation(token);

  if (!invitation || !invitation.course.isPublished) {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="text-3xl font-semibold text-azure-800">Einladung nicht mehr gültig</h1>
        <p className="text-brand-900/80">
          Dieser Einladungslink ist abgelaufen, wurde schon benutzt oder ist unvollständig. Bitte
          frag die Person, die dich eingeladen hat, nach einem neuen Link.
        </p>
        <Link href="/" className="font-medium text-azure-800 underline">
          Zur Startseite
        </Link>
      </div>
    );
  }

  // Angemeldet: direkt weiter zur Kursanmeldung mit dieser Einladung. Ging die Einladung an eine
  // andere Adresse als die des Kontos, vorher nachfragen (sonst wird leicht das falsche Konto,
  // z. B. ein Admin, eingeschrieben).
  const session = await auth();
  const enrollPath = enrollPathForInvitation(invitation.course, token);
  if (session) {
    const account = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    });
    const matches =
      !invitation.email || !account || normalizeEmail(invitation.email) === normalizeEmail(account.email);
    if (matches) redirect(enrollPath);

    return (
      <div className="mx-auto max-w-md space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-azure-700">Einladung</p>
          <h1 className="mt-1 text-3xl font-semibold leading-tight text-azure-800">Anderes Konto angemeldet</h1>
        </div>
        <p className="text-brand-900/85">
          Du bist als <strong className="text-brand-900">{account.name}</strong> ({account.email}) angemeldet. Die
          Einladung zum Kurs <strong className="text-brand-900">{invitation.course.title}</strong> ging an{" "}
          <strong className="text-brand-900">{shortenEmail(invitation.email ?? "")}</strong>.
        </p>
        <p className="text-brand-900/85">
          Möchtest du mit dem eingeladenen Konto teilnehmen? Dann wechsle das Konto. Gehört dieses Konto dir und soll
          die Anmeldung darüber laufen (z. B. für dein Kind), mach einfach weiter.
        </p>
        <div className="flex flex-wrap gap-3">
          <SwitchAccountButton callbackUrl={invitationPath(token)} />
          <Link
            href={enrollPath}
            className="border border-brand-300 bg-white px-5 py-2.5 font-medium text-brand-900 hover:bg-brand-50"
          >
            Trotzdem mit diesem Konto weiter
          </Link>
        </div>
      </div>
    );
  }

  const back = encodeURIComponent(invitationPath(token));
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-azure-700">Einladung</p>
        <h1 className="mt-1 text-3xl font-semibold leading-tight text-azure-800">
          {invitation.name ? `Salam alaykum ${invitation.name}!` : "Salam alaykum!"}
        </h1>
      </div>
      <p className="text-brand-900/85">
        {callName(invitation.invitedBy)} lädt dich zum Kurs{" "}
        <strong className="text-brand-900">{invitation.course.title}</strong> ein.{" "}
        {invitation.freeEnrollment
          ? "Die Teilnahme ist für dich kostenlos."
          : "Die Anmeldung und Bezahlung erledigst du im nächsten Schritt."}
      </p>
      <p className="text-brand-900/85">
        Melde dich an oder lege ein Konto an. Danach geht es direkt weiter zur Anmeldung für den
        Kurs, für dich selbst oder für dein Kind.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href={`/auth/signup?callbackUrl=${back}`} className="btn-primary btn-display px-5 py-2.5">
          Konto anlegen
        </Link>
        <Link
          href={`/auth/signin?callbackUrl=${back}`}
          className="border border-brand-300 bg-white px-5 py-2.5 font-medium text-brand-900 hover:bg-brand-50"
        >
          Ich habe schon ein Konto
        </Link>
      </div>
    </div>
  );
}
