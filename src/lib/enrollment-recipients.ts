// Empfaenger fuer Erinnerungen und Kursmaterial: jeder Teilnehmer mit eigener E-Mail-Adresse
// bekommt die Mail selbst, alle anderen (z. B. Kinder) ueber den Konto-Inhaber. Mehrere
// Teilnehmer mit derselben Adresse (zwei Kinder eines Elternteils) erhalten eine gemeinsame
// Mail statt mehrerer gleicher.

import { callName } from "@/lib/names";

type EnrollmentLike = {
  participant: { name: string; muslimName?: string | null; email: string | null };
  user: { name: string; muslimName?: string | null; email: string };
};

export type Recipient = {
  email: string;
  // Anrede in der Mail, z. B. "Ali" oder "Fatima (für Ali, Mariam)"
  greetingName: string;
  participantNames: string[];
};

export function groupRecipients(enrollments: EnrollmentLike[]): Recipient[] {
  const byEmail = new Map<string, { email: string; ownerName: string; ownMail: boolean; names: string[] }>();

  for (const { participant, user } of enrollments) {
    const ownMail = Boolean(participant.email);
    const email = (participant.email ?? user.email).trim();
    const key = email.toLowerCase();
    // Angeredet wird mit dem muslimischen Namen, falls angegeben.
    const entry = byEmail.get(key) ?? { email, ownerName: callName(user), ownMail, names: [] };
    const participantName = callName(participant);
    if (!entry.names.includes(participantName)) entry.names.push(participantName);
    byEmail.set(key, entry);
  }

  return [...byEmail.values()].map((entry) => {
    const others = entry.names.filter((name) => name !== entry.ownerName);
    const ownerParticipates = entry.names.includes(entry.ownerName);
    let greetingName: string;
    if (others.length === 0) greetingName = entry.ownerName;
    else if (entry.ownMail && entry.names.length === 1) greetingName = entry.names[0];
    else if (ownerParticipates) greetingName = `${entry.ownerName} (auch für ${others.join(", ")})`;
    else greetingName = `${entry.ownerName} (für ${others.join(", ")})`;
    return { email: entry.email, greetingName, participantNames: entry.names };
  });
}
