// Regeln fuer Teilnehmer, gemeinsam fuer das Anmeldeformular im Browser und die Pruefung auf
// dem Server (/api/enrollments/checkout). Die Fehlertexte sind fuer die Anzeige am Feld gedacht.

export type ParticipantRelationValue = "SELF" | "CHILD" | "OTHER";

export const MAX_PARTICIPANTS_PER_ORDER = 10;

// Kinder und Jugendliche sind unter 18. Fuer Kinder fragen wir nur das Geburtsjahr; die untere
// Grenze verhindert Tippfehler.
const CHILD_MIN_AGE = 4;
const CHILD_MAX_AGE = 17;

export function childBirthYearRange(now: Date = new Date()) {
  const year = now.getFullYear();
  return { min: year - CHILD_MAX_AGE, max: year - CHILD_MIN_AGE };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value.trim()) && value.trim().length <= 200;
}

// Vereinheitlicht eine WhatsApp-Nummer auf das internationale Format (+491701234567).
// Eine fuehrende 0 wird als deutsche Nummer gelesen. Gibt null zurueck, wenn die Nummer
// offensichtlich ungueltig ist.
export function normalizeWhatsapp(input: string): string | null {
  let digits = input.replace(/[\s().\-/]/g, "");
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;
  else if (digits.startsWith("0")) digits = `+49${digits.slice(1)}`;
  return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export type ParticipantInput = {
  relation: ParticipantRelationValue;
  name: string;
  email: string;
  birthYear: string;
  whatsapp: string;
  whatsappConsent: boolean;
  // CHILD: Erziehungsberechtigung. OTHER: erwachsen und mit der Anmeldung einverstanden.
  consentConfirmed: boolean;
};

export type ParticipantField =
  | "name"
  | "email"
  | "birthYear"
  | "whatsapp"
  | "whatsappConsent"
  | "consentConfirmed";

export type ParticipantErrors = Partial<Record<ParticipantField, string>>;

export type CleanParticipant = {
  relation: ParticipantRelationValue;
  name: string;
  email: string | null;
  birthYear: number | null;
  whatsapp: string | null;
  whatsappConsent: boolean;
  consentConfirmed: boolean;
};

export function emptyParticipantInput(relation: ParticipantRelationValue): ParticipantInput {
  return {
    relation,
    name: "",
    email: "",
    birthYear: "",
    whatsapp: "",
    whatsappConsent: false,
    consentConfirmed: false,
  };
}

// Prueft eine Teilnehmer-Eingabe. Bei Fehlern enthaelt `errors` mindestens einen Eintrag,
// sonst liefert `clean` die bereinigten Daten.
export function validateParticipant(
  input: ParticipantInput,
  now: Date = new Date(),
): { errors: ParticipantErrors; clean: CleanParticipant | null } {
  const errors: ParticipantErrors = {};
  const name = input.name.trim().replace(/\s+/g, " ");
  const email = input.email.trim();

  if (name.length < 2) errors.name = "Bitte gib den vollständigen Namen an.";
  else if (name.length > 80) errors.name = "Der Name ist zu lang.";

  let birthYear: number | null = null;
  if (input.relation === "CHILD") {
    const range = childBirthYearRange(now);
    const parsed = Number(input.birthYear);
    if (!/^\d{4}$/.test(input.birthYear.trim()) || !Number.isInteger(parsed)) {
      errors.birthYear = "Bitte gib das Geburtsjahr vierstellig an, z. B. 2015.";
    } else if (parsed < range.min) {
      errors.birthYear = `Kinder und Jugendliche sind unter 18. Für Erwachsene wähle „Andere Person“ (Geburtsjahr ab ${range.min}).`;
    } else if (parsed > range.max) {
      errors.birthYear = "Bitte prüfe das Geburtsjahr.";
    } else {
      birthYear = parsed;
    }
    if (!input.consentConfirmed) {
      errors.consentConfirmed = "Bitte bestätige, dass du für dieses Kind sorgeberechtigt bist.";
    }
    if (email && !isValidEmail(email)) errors.email = "Bitte gib eine gültige E-Mail-Adresse an.";
  } else {
    if (!isValidEmail(email)) {
      errors.email =
        input.relation === "SELF"
          ? "Bitte gib deine E-Mail-Adresse an."
          : "Bitte gib die E-Mail-Adresse der Person an, z. B. name@beispiel.de.";
    }
    if (input.relation === "OTHER" && !input.consentConfirmed) {
      errors.consentConfirmed =
        "Bitte bestätige, dass die Person mindestens 18 Jahre alt und mit der Anmeldung einverstanden ist.";
    }
  }

  let whatsapp: string | null = null;
  if (input.whatsapp.trim()) {
    whatsapp = normalizeWhatsapp(input.whatsapp);
    if (!whatsapp) {
      errors.whatsapp = "Bitte gib die Nummer mit Vorwahl an, z. B. +49 170 1234567.";
    } else if (!input.whatsappConsent) {
      errors.whatsappConsent =
        "Bitte stimme zu, dass die Nummer für die WhatsApp-Gruppe verwendet wird, oder lass das Feld leer.";
    }
  }

  if (Object.keys(errors).length > 0) return { errors, clean: null };

  return {
    errors,
    clean: {
      relation: input.relation,
      name,
      email: email || null,
      birthYear,
      whatsapp,
      whatsappConsent: Boolean(whatsapp) && input.whatsappConsent,
      consentConfirmed: input.consentConfirmed,
    },
  };
}
