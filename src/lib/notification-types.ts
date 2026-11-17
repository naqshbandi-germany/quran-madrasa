// Ereignistypen der Benachrichtigungen mit Beschriftung, Empfängern und E-Mail-Standard.
// Wird auch in Client-Komponenten verwendet und darf deshalb nichts Serverseitiges importieren
// (den Typ NotificationType gibt es hier als eigene Liste, gleich wie im Prisma-Schema).

export const NOTIFICATION_TYPES = [
  "ENROLLMENT_CREATED",
  "SUBSCRIPTION_CANCELED",
  "SUBSCRIPTION_ENDED",
  "READING_SAMPLE_UPLOADED",
  "WAITLIST_JOINED",
  "PAYMENT_FAILED",
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPES)[number];

// course = an die Lehrkraft des Kurses, admins = an alle Admins.
export type NotificationAudience = "course" | "admins";

export const NOTIFICATION_TYPE_INFO: Record<
  NotificationTypeKey,
  { label: string; description: string; audience: NotificationAudience; emailByDefault: boolean }
> = {
  ENROLLMENT_CREATED: {
    label: "Neuer Schüler angemeldet",
    description: "Nach erfolgreicher Zahlung ist ein Teilnehmer neu im Kurs eingeschrieben.",
    audience: "course",
    emailByDefault: true,
  },
  SUBSCRIPTION_CANCELED: {
    label: "Abo gekündigt",
    description: "Ein Teilnehmer hat zum Ende des Abrechnungszeitraums gekündigt.",
    audience: "course",
    emailByDefault: true,
  },
  SUBSCRIPTION_ENDED: {
    label: "Abo beendet",
    description: "Das Abo ist abgelaufen, die Teilnehmer sind aus dem Kurs ausgetragen.",
    audience: "course",
    emailByDefault: false,
  },
  READING_SAMPLE_UPLOADED: {
    label: "Leseprobe hochgeladen",
    description: "Ein Teilnehmer hat eine Leseprobe aufgenommen oder hochgeladen.",
    audience: "course",
    emailByDefault: true,
  },
  WAITLIST_JOINED: {
    label: "Eintrag auf der Warteliste",
    description: "Jemand hat sich in die Warteliste eines ausgebuchten Kurses eingetragen.",
    audience: "course",
    emailByDefault: false,
  },
  PAYMENT_FAILED: {
    label: "Zahlung fehlgeschlagen",
    description: "Stripe konnte eine Abo-Zahlung nicht einziehen (nur für Admins).",
    audience: "admins",
    emailByDefault: true,
  },
};

// Ereignistypen, die eine Person bekommen kann: Lehrkraefte die Kurs-Ereignisse, Admins alle.
export function typesForRole(role: string): NotificationTypeKey[] {
  return NOTIFICATION_TYPES.filter((t) => role === "ADMIN" || NOTIFICATION_TYPE_INFO[t].audience === "course");
}

export function isNotificationType(value: string): value is NotificationTypeKey {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

// Zusatzdaten eines Ereignisses (Namen zum Zeitpunkt des Ereignisses, damit der Verlauf auch
// nach dem Löschen von Kurs oder Teilnehmer lesbar bleibt).
export type EventData = {
  course?: string;
  participants?: string[];
  owner?: string;
  ownerEmail?: string;
  periodEnd?: string;
  note?: string;
  // Hoerprobe eines Probestunden-Gastes (ohne Konto)
  trial?: boolean;
};

function names(data: EventData) {
  const list = data.participants ?? [];
  if (list.length === 0) return data.owner ?? "Ein Teilnehmer";
  return list.join(", ");
}

function account(data: EventData) {
  const people = data.participants ?? [];
  if (!data.owner || (people.length === 1 && people[0] === data.owner)) return "";
  return ` (Konto: ${data.owner})`;
}

function plural(data: EventData, one: string, many: string) {
  return (data.participants?.length ?? 1) > 1 ? many : one;
}

// Überschrift und Text eines Ereignisses für Feed und E-Mail.
export function describeEvent(type: NotificationTypeKey, data: EventData): { title: string; detail: string } {
  const course = data.course ? `„${data.course}“` : "den Kurs";
  switch (type) {
    case "ENROLLMENT_CREATED":
      return {
        title: `Neue Anmeldung: ${data.course ?? "Kurs"}`,
        detail: `${names(data)}${account(data)} ${plural(data, "ist", "sind")} jetzt im Kurs ${course} eingeschrieben.`,
      };
    case "SUBSCRIPTION_CANCELED":
      return {
        title: `Abo gekündigt: ${data.course ?? "Kurs"}`,
        detail: `Das Abo für ${names(data)}${account(data)} im Kurs ${course} wurde gekündigt${
          data.periodEnd ? ` und endet am ${data.periodEnd}` : ""
        }. Bis dahin ${plural(data, "bleibt die Teilnahme", "bleiben die Teilnehmer")} bestehen.`,
      };
    case "SUBSCRIPTION_ENDED":
      return {
        title: `Abo beendet: ${data.course ?? "Kurs"}`,
        detail: `Das Abo für ${names(data)}${account(data)} im Kurs ${course} ist beendet. ${plural(
          data,
          "Der Teilnehmer ist",
          "Die Teilnehmer sind",
        )} nicht mehr eingeschrieben.`,
      };
    case "READING_SAMPLE_UPLOADED":
      return {
        title: data.trial ? `Neue Hörprobe zur Probestunde: ${data.course ?? "Kurs"}` : `Neue Leseprobe: ${data.course ?? "Kurs"}`,
        detail: `${names(data)} hat ${data.trial ? `für die Probestunde im Kurs ${course} eine Hörprobe` : `im Kurs ${course} eine Leseprobe`} hochgeladen.${
          data.note ? ` Hinweis: „${data.note}“` : ""
        }`,
      };
    case "WAITLIST_JOINED":
      return {
        title: `Warteliste: ${data.course ?? "Kurs"}`,
        detail: `${data.owner ?? "Jemand"} hat sich in die Warteliste für ${course} eingetragen.`,
      };
    case "PAYMENT_FAILED":
      return {
        title: `Zahlung fehlgeschlagen${data.course ? `: ${data.course}` : ""}`,
        detail: `Die Abo-Zahlung von ${data.owner ?? "einem Konto"}${
          data.ownerEmail ? ` (${data.ownerEmail})` : ""
        }${data.course ? ` für ${course}` : ""} konnte nicht eingezogen werden. Stripe versucht es noch einige Male; die Person wurde per E-Mail gebeten, ihre Zahlungsdaten zu prüfen.`,
      };
  }
}

// Ziel eines Ereignisses im Lehrer- bzw. Admin-Bereich.
export function eventHref(type: NotificationTypeKey, courseId: string | null, data?: EventData): string | null {
  if (type === "PAYMENT_FAILED") return "/admin/konten";
  if (data?.trial) return "/teacher/termine";
  if (!courseId) return null;
  if (type === "READING_SAMPLE_UPLOADED") return `/teacher/courses/${courseId}/leseproben`;
  return `/teacher/courses/${courseId}`;
}
