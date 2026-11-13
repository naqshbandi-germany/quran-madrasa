// Alle automatisch verschickten E-Mails mit ihren Standardtexten und Platzhaltern. Im
// Admin-Bereich (/admin/emails) lassen sich Betreff, Text, Button-Beschriftung und Hinweis
// pro Mail anpassen; ohne gespeicherten Text (Tabelle EmailTemplate) gilt der Text hier.
//
// Textformat: Absaetze durch eine Leerzeile trennen, **fett** fuer Hervorhebungen,
// Platzhalter als {{name}}. Steht {{button}} allein in einem Absatz, erscheint der Button
// dort, sonst unter dem Text. Diese Datei wird auch im Browser (Vorschau) verwendet und darf
// deshalb nichts Serverseitiges importieren.

export type Placeholder = {
  key: string;
  label: string;
  example: string;
  // Fertiges HTML aus dem Code (z. B. eine Terminliste), wird nicht maskiert und steht am
  // besten allein in einem Absatz.
  html?: boolean;
};

export type EmailContent = {
  subject: string;
  body: string;
  buttonLabel: string;
  footer: string;
};

type TemplateDefinition = {
  label: string;
  group: string;
  description: string;
  placeholders: readonly Placeholder[];
  // Ziel des Buttons ist immer {{link}}; ohne Button hat die Mail keinen.
  hasButton: boolean;
  defaults: EmailContent;
};

const GREETING = "Salam alaykum {{name}},";

const NAME = { key: "name", label: "Name des Empfängers (bei Kindern: Elternteil mit Namen der Kinder)", example: "Fatima (für Ali, Mariam)" } as const;
const KURS = { key: "kurs", label: "Titel des Kurses", example: "Tajweed für Anfänger" } as const;
const LEHRER = { key: "lehrer", label: "Name der Lehrkraft", example: "Ustadh Yusuf" } as const;
const DATUM = { key: "datum", label: "Datum und Uhrzeit der Stunde", example: "Freitag, 14. November 2026 um 18:00 Uhr (deutsche Zeit)" } as const;
const STUNDE = { key: "stunde", label: "Titel der Stunde", example: "Lektion 5: Madd-Regeln" } as const;
const KURS_LINK = { key: "link", label: "Link zu „Meine Kurse“ (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/dashboard" } as const;
const BUTTON = { key: "button", label: "Position des Buttons (optional, sonst unter dem Text)", example: "" } as const;

const ENROLLED_FOOTER = "Diese E-Mail wurde automatisch verschickt, weil du bei diesem Kurs eingeschrieben bist.";
const CONTACT_FOOTER = "Bei Fragen erreichst du uns unter admin@islamunterfreunden.de.";

const reminderPlaceholders = [
  NAME,
  KURS,
  DATUM,
  { key: "link", label: "Link zum Unterrichtsraum (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/dashboard/classroom/abc123" },
  BUTTON,
] as const;
const reminderFooter = "Diese Erinnerung wurde automatisch verschickt, weil du bei diesem Kurs eingeschrieben bist.";

export const EMAIL_TEMPLATES = {
  enrollment_confirmed: {
    label: "Anmeldung bestätigt",
    group: "Kurs und Termine",
    description: "Nach erfolgreicher Anmeldung bzw. Zahlung an die neu eingeschriebenen Teilnehmer.",
    placeholders: [
      NAME,
      KURS,
      LEHRER,
      { key: "teilnehmer", label: "Namen der angemeldeten Teilnehmer", example: "Ali, Mariam" },
      {
        key: "termine",
        label: "Liste der nächsten drei Termine (oder Hinweis, dass sie noch bekannt gegeben werden)",
        example:
          "<p><strong>Die nächsten Termine:</strong></p><ul><li>Lektion 1: Freitag, 14. November 2026 um 18:00 Uhr (deutsche Zeit)</li><li>Lektion 2: Freitag, 21. November 2026 um 18:00 Uhr (deutsche Zeit)</li></ul>",
        html: true,
      },
      KURS_LINK,
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: 'Anmeldung bestätigt: "{{kurs}}"',
      body: [
        GREETING,
        "die Anmeldung zum Kurs **{{kurs}}** bei {{lehrer}} ist bestätigt. Teilnehmer: {{teilnehmer}}.",
        "{{termine}}",
        "Vor jeder Stunde erinnern wir dich per E-Mail (24 Stunden und 1 Stunde vorher). Im Bereich „Meine Kurse“ findest du alle Termine, den Link zum Unterricht und ein Kalender-Abo für dein Handy oder deinen Computer.",
      ].join("\n\n"),
      buttonLabel: "Zu meinen Kursen",
      footer: `Diese E-Mail wurde automatisch nach deiner Anmeldung verschickt. ${CONTACT_FOOTER}`,
    },
  },
  reminder_24h: {
    label: "Erinnerung 24 Stunden vorher",
    group: "Kurs und Termine",
    description: "Automatisch einen Tag vor jeder Stunde an alle Teilnehmer des Kurses.",
    placeholders: reminderPlaceholders,
    hasButton: true,
    defaults: {
      subject: 'Erinnerung: "{{kurs}}" morgen',
      body: [GREETING, "dein Kurs **{{kurs}}** findet morgen statt.", "**Wann:** {{datum}}"].join("\n\n"),
      buttonLabel: "Klasse beitreten",
      footer: reminderFooter,
    },
  },
  reminder_1h: {
    label: "Erinnerung 1 Stunde vorher",
    group: "Kurs und Termine",
    description: "Automatisch eine Stunde vor jeder Stunde an alle Teilnehmer des Kurses.",
    placeholders: reminderPlaceholders,
    hasButton: true,
    defaults: {
      subject: `Gleich geht's los: "{{kurs}}" in einer Stunde`,
      body: [GREETING, "dein Kurs **{{kurs}}** findet in einer Stunde statt.", "**Wann:** {{datum}}"].join("\n\n"),
      buttonLabel: "Klasse beitreten",
      footer: reminderFooter,
    },
  },
  reminder_start: {
    label: "Stunde hat begonnen",
    group: "Kurs und Termine",
    description: "Automatisch zu Beginn jeder Stunde an alle Teilnehmer des Kurses.",
    placeholders: reminderPlaceholders,
    hasButton: true,
    defaults: {
      subject: 'Jetzt live: "{{kurs}}" hat begonnen',
      body: [GREETING, "dein Kurs **{{kurs}}** hat gerade begonnen.", "**Wann:** {{datum}}"].join("\n\n"),
      buttonLabel: "Klasse beitreten",
      footer: reminderFooter,
    },
  },
  session_moved: {
    label: "Stunde verschoben",
    group: "Kurs und Termine",
    description: "Wenn die Lehrkraft eine kommende Stunde verschiebt, an alle Teilnehmer des Kurses.",
    placeholders: [
      NAME,
      KURS,
      STUNDE,
      { key: "datum_alt", label: "Bisheriger Termin", example: "Freitag, 14. November 2026 um 18:00 Uhr (deutsche Zeit)" },
      { key: "datum", label: "Neuer Termin", example: "Samstag, 15. November 2026 um 10:00 Uhr (deutsche Zeit)" },
      { key: "dauer", label: "Dauer der Stunde in Minuten", example: "60" },
      KURS_LINK,
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: 'Termin verschoben: "{{kurs}}"',
      body: [
        GREETING,
        "die Stunde **{{stunde}}** im Kurs **{{kurs}}** wurde verschoben.",
        "**Bisher:** {{datum_alt}}\n**Neu:** {{datum}} ({{dauer}} Minuten)",
        "Der Link zum Unterricht bleibt gleich. Ein abonnierter Kalender aktualisiert sich von selbst.",
      ].join("\n\n"),
      buttonLabel: "Alle Termine ansehen",
      footer: ENROLLED_FOOTER,
    },
  },
  session_cancelled: {
    label: "Stunde fällt aus",
    group: "Kurs und Termine",
    description: "Wenn die Lehrkraft eine kommende Stunde absagt, an alle Teilnehmer des Kurses.",
    placeholders: [NAME, KURS, STUNDE, DATUM, KURS_LINK, BUTTON],
    hasButton: true,
    defaults: {
      subject: 'Stunde fällt aus: "{{kurs}}"',
      body: [
        GREETING,
        "die Stunde **{{stunde}}** im Kurs **{{kurs}}** am {{datum}} fällt leider aus.",
        "Über einen Ersatztermin informieren wir dich gesondert.",
      ].join("\n\n"),
      buttonLabel: "Alle Termine ansehen",
      footer: ENROLLED_FOOTER,
    },
  },
  payment_failed: {
    label: "Zahlung fehlgeschlagen",
    group: "Zahlung und Abo",
    description: "Wenn Stripe eine Abo-Zahlung nicht einziehen konnte, an den Konto-Inhaber.",
    placeholders: [
      NAME,
      { key: "kurs", label: "Titel des Kurses (falls unbekannt: „deine Teilnahme“)", example: "Tajweed für Anfänger" },
      { key: "link", label: "Link zu den Zahlungsdaten (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/dashboard/billing" },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Zahlung fehlgeschlagen: bitte Zahlungsdaten prüfen",
      body: [
        GREETING,
        "die letzte Zahlung für **{{kurs}}** konnte leider nicht eingezogen werden, zum Beispiel weil die Karte abgelaufen ist oder das Konto nicht gedeckt war.",
        "Bitte prüfe deine Zahlungsdaten. Wir versuchen es in den nächsten Tagen automatisch noch einmal. Deine Teilnahme läuft bis dahin weiter.",
      ].join("\n\n"),
      buttonLabel: "Zahlungsdaten prüfen",
      footer: CONTACT_FOOTER,
    },
  },
  participant_removed: {
    label: "Teilnehmer ausgetragen",
    group: "Zahlung und Abo",
    description: "Wenn die Lehrkraft einen Teilnehmer aus dem Kurs entfernt, an den Konto-Inhaber.",
    placeholders: [
      { key: "name", label: "Name des Konto-Inhabers", example: "Fatima" },
      { key: "teilnehmer", label: "Name des ausgetragenen Teilnehmers", example: "Ali" },
      KURS,
      {
        key: "abo",
        label: "Satz zum Abo (beendet oder verkleinert)",
        example: "Dein Abo wurde um einen Teilnehmer verkleinert und wird ab der nächsten Abrechnung entsprechend berechnet.",
      },
    ],
    hasButton: false,
    defaults: {
      subject: "Austragung aus dem Kurs {{kurs}}",
      body: [
        GREETING,
        "**{{teilnehmer}}** wurde von der Lehrkraft aus dem Kurs **{{kurs}}** ausgetragen.",
        "{{abo}} Für den laufenden Monat erfolgt keine Rückerstattung.",
      ].join("\n\n"),
      buttonLabel: "",
      footer: "Bei Fragen antworte einfach auf diese Nachricht.",
    },
  },
  waitlist_joined: {
    label: "Warteliste: Eintrag bestätigt",
    group: "Warteliste",
    description: "Nach dem Eintragen in die Warteliste eines Kurses.",
    placeholders: [{ key: "name", label: "Name aus dem Wartelisten-Formular", example: "Fatima" }, KURS],
    hasButton: false,
    defaults: {
      subject: "Warteliste: {{kurs}}",
      body: [
        GREETING,
        "du stehst jetzt auf der Warteliste für den Kurs **{{kurs}}**.",
        "Sobald ein Platz frei wird, melden wir uns bei dir, auch für das nächste Semester. Eine Zahlung ist dafür nicht nötig.",
      ].join("\n\n"),
      buttonLabel: "",
      footer: "Du hast diese Nachricht erhalten, weil du dich auf unserer Website in die Warteliste eingetragen hast.",
    },
  },
  waitlist_offer: {
    label: "Warteliste: Platz frei",
    group: "Warteliste",
    description: "Wenn die Lehrkraft einen Wartenden anschreibt, weil ein Platz frei geworden ist.",
    placeholders: [
      { key: "name", label: "Name aus dem Wartelisten-Formular", example: "Fatima" },
      KURS,
      LEHRER,
      { key: "link", label: "Link zur Anmeldung (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/courses/tajweed/anmelden" },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Platz frei: {{kurs}}",
      body: [
        GREETING,
        "im Kurs **{{kurs}}** ist ein Platz frei geworden. Besteht weiterhin Interesse, dass du teilnimmst?",
        "Dann melde dich hier an:",
        "{{button}}",
        "Der Platz wird nicht reserviert: Wer sich zuerst anmeldet, bekommt ihn. Wenn du kein Interesse mehr hast, brauchst du nichts zu tun.",
        "Viele Grüße\n{{lehrer}}",
      ].join("\n\n"),
      buttonLabel: "Zur Anmeldung",
      footer: "",
    },
  },
  password_reset: {
    label: "Passwort zurücksetzen",
    group: "Konto",
    description: "Wenn jemand auf der Anmeldeseite „Passwort vergessen?“ nutzt.",
    placeholders: [
      { key: "name", label: "Name des Kontos", example: "Fatima" },
      { key: "link", label: "Link zum Festlegen des neuen Passworts (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/auth/passwort-zuruecksetzen?token=…" },
      { key: "minuten", label: "Gültigkeit des Links in Minuten", example: "60" },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Passwort zurücksetzen",
      body: [
        GREETING,
        "du hast darum gebeten, dein Passwort zurückzusetzen. Mit diesem Link legst du ein neues Passwort fest. Er ist {{minuten}} Minuten gültig und nur einmal nutzbar:",
      ].join("\n\n"),
      buttonLabel: "Neues Passwort festlegen",
      footer: "Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren; dein Passwort bleibt dann unverändert.",
    },
  },
  teacher_invite: {
    label: "Lehrer-Einladung",
    group: "Konto",
    description: "Wenn der Admin eine Lehrkraft einlädt; sie legt damit ihr eigenes Passwort fest.",
    placeholders: [
      { key: "name", label: "Name der Lehrkraft", example: "Ustadh Yusuf" },
      { key: "email", label: "E-Mail-Adresse (Benutzername) der Lehrkraft", example: "yusuf@example.org" },
      { key: "link", label: "Link zum Festlegen des Passworts (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/auth/passwort-zuruecksetzen?token=…&einladung=1" },
      { key: "tage", label: "Gültigkeit des Links in Tagen", example: "7" },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Dein Lehrer-Zugang bei Quran Madrasa",
      body: [
        GREETING,
        "für dich wurde ein Lehrer-Zugang bei Quran Madrasa angelegt. Dein Benutzername ist deine E-Mail-Adresse **{{email}}**.",
        "Bitte lege über diesen Link dein eigenes Passwort fest. Der Link ist {{tage}} Tage gültig und nur einmal nutzbar:",
        "{{button}}",
        "Danach meldest du dich mit deiner E-Mail-Adresse und dem neuen Passwort an und findest unter „Meine Kurse“ deine Kurse.",
      ].join("\n\n"),
      buttonLabel: "Passwort festlegen",
      footer: "Ist der Link abgelaufen, kannst du auf der Anmeldeseite über „Passwort vergessen?“ jederzeit einen neuen anfordern.",
    },
  },
} as const satisfies Record<string, TemplateDefinition>;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;

// Werte, die der Code beim Versand fuer eine Mail liefern muss ({{button}} setzt der Renderer).
export type EmailValues<K extends EmailTemplateKey> = Record<
  Exclude<(typeof EMAIL_TEMPLATES)[K]["placeholders"][number]["key"], "button">,
  string
>;

export const EMAIL_GROUPS = ["Kurs und Termine", "Zahlung und Abo", "Warteliste", "Konto"] as const;

export function isEmailTemplateKey(key: string): key is EmailTemplateKey {
  return Object.prototype.hasOwnProperty.call(EMAIL_TEMPLATES, key);
}

export function getTemplateDefinition(key: EmailTemplateKey): TemplateDefinition {
  return EMAIL_TEMPLATES[key];
}

export function exampleValues(key: EmailTemplateKey): Record<string, string> {
  return Object.fromEntries(getTemplateDefinition(key).placeholders.map((p) => [p.key, p.example]));
}
