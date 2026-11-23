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
const reminder24hPlaceholders = [
  ...reminderPlaceholders,
  {
    key: "leseprobe",
    label: "Hinweis auf eine von der Lehrkraft erbetene Leseprobe mit Link zur Aufnahme (leer, wenn keine erbeten ist)",
    example:
      '<div style="margin: 24px 0; padding: 12px 16px; background: #f4f1e8; border-left: 3px solid #b8963e;"><p style="margin: 0 0 8px;"><strong>Leseprobe erbeten:</strong> Sure Al-Mulk, Verse 1-5</p><p style="margin: 0 0 12px; font-size: 14px;">Bitte nimm den Abschnitt vor der Stunde kurz auf. Die Lehrkraft hört ihn sich an und kann sich so gezielt vorbereiten. Nur die Lehrkraft kann die Aufnahme hören.</p><a href="#" style="color: #1d6347; font-weight: bold;">Leseprobe aufnehmen</a></div>',
    html: true,
  },
] as const;
// Hoerprobe zur Probestunde (persoenlicher Link ohne Konto); leer, wenn keine erbeten ist.
const TRIAL_SAMPLE = {
  key: "hoerprobe",
  label: "Bitte um eine Hörprobe mit persönlichem Link zur Aufnahme (leer, wenn keine erbeten ist)",
  example:
    '<div style="margin: 24px 0; padding: 12px 16px; background: #f4f1e8; border-left: 3px solid #b8963e;"><p style="margin: 0 0 8px;"><strong>Hörprobe erbeten:</strong> Sure 67 Al-Mulk, Verse 1–10</p><p style="margin: 0 0 12px; font-size: 14px;">Bitte lies den Abschnitt vor der Probestunde laut vor und nimm ihn auf. Die Lehrkraft hört ihn sich an und kann sich so gezielt vorbereiten. Ein Konto brauchst du dafür nicht.</p><a href="#" style="color: #1d6347; font-weight: bold;">Hörprobe aufnehmen</a></div>',
  html: true,
} as const;
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
    description: "Automatisch einen Tag vor jeder Stunde an alle Teilnehmer des Kurses, ggf. mit der Bitte um eine Leseprobe.",
    placeholders: reminder24hPlaceholders,
    hasButton: true,
    defaults: {
      subject: 'Erinnerung: "{{kurs}}" morgen',
      body: [
        GREETING,
        "dein Kurs **{{kurs}}** findet morgen statt.",
        "**Wann:** {{datum}}",
        "{{button}}",
        "{{leseprobe}}",
      ].join("\n\n"),
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
  email_change_confirm: {
    label: "Neue E-Mail-Adresse bestätigen",
    group: "Konto",
    description: "An die neue Adresse, wenn jemand unter „Mein Konto“ die E-Mail-Adresse ändert.",
    placeholders: [
      { key: "name", label: "Name des Kontos", example: "Fatima" },
      { key: "link", label: "Link zum Bestätigen (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/auth/email-bestaetigen?token=…" },
      { key: "minuten", label: "Gültigkeit des Links in Minuten", example: "60" },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Neue E-Mail-Adresse bestätigen",
      body: [
        GREETING,
        "du möchtest dich künftig mit dieser E-Mail-Adresse anmelden. Bitte bestätige sie mit diesem Link. Er ist {{minuten}} Minuten gültig und nur einmal nutzbar:",
      ].join("\n\n"),
      buttonLabel: "Adresse bestätigen",
      footer: "Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren; dann ändert sich nichts.",
    },
  },
  email_changed: {
    label: "E-Mail-Adresse geändert",
    group: "Konto",
    description: "Hinweis an die bisherige Adresse, nachdem die neue bestätigt wurde.",
    placeholders: [
      { key: "name", label: "Name des Kontos", example: "Fatima" },
      { key: "neu", label: "Neue E-Mail-Adresse", example: "fatima@example.de" },
    ],
    hasButton: false,
    defaults: {
      subject: "Deine E-Mail-Adresse wurde geändert",
      body: [
        GREETING,
        "die E-Mail-Adresse deines Kontos bei Islam unter Freunden wurde geändert. Du meldest dich jetzt mit {{neu}} an.",
        "Warst du das nicht? Dann melde dich bitte sofort bei admin@islamunterfreunden.de.",
      ].join("\n\n"),
      buttonLabel: "",
      footer: "Diese E-Mail ging zur Sicherheit an deine bisherige Adresse.",
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
      subject: "Dein Lehrer-Zugang bei Islam unter Freunden",
      body: [
        GREETING,
        "für dich wurde ein Lehrer-Zugang bei Islam unter Freunden angelegt. Dein Benutzername ist deine E-Mail-Adresse **{{email}}**.",
        "Bitte lege über diesen Link dein eigenes Passwort fest. Der Link ist {{tage}} Tage gültig und nur einmal nutzbar:",
        "{{button}}",
        "Danach meldest du dich mit deiner E-Mail-Adresse und dem neuen Passwort an und findest unter „Meine Kurse“ deine Kurse.",
      ].join("\n\n"),
      buttonLabel: "Passwort festlegen",
      footer: "Ist der Link abgelaufen, kannst du auf der Anmeldeseite über „Passwort vergessen?“ jederzeit einen neuen anfordern.",
    },
  },
  admin_invite: {
    label: "Admin-Einladung",
    group: "Konto",
    description: "Wenn ein Admin jemanden als weiteren Admin einlädt; die Person legt damit ihr eigenes Passwort fest.",
    placeholders: [
      { key: "name", label: "Name der eingeladenen Person", example: "Ahmad" },
      { key: "email", label: "E-Mail-Adresse (Benutzername)", example: "ahmad@example.org" },
      { key: "link", label: "Link zum Festlegen des Passworts (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/auth/passwort-zuruecksetzen?token=…&einladung=1" },
      { key: "tage", label: "Gültigkeit des Links in Tagen", example: "7" },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Dein Admin-Zugang bei Islam unter Freunden",
      body: [
        GREETING,
        "für dich wurde ein Admin-Zugang bei Islam unter Freunden angelegt. Dein Benutzername ist deine E-Mail-Adresse **{{email}}**.",
        "Bitte lege über diesen Link dein eigenes Passwort fest. Der Link ist {{tage}} Tage gültig und nur einmal nutzbar:",
        "{{button}}",
        "Danach meldest du dich mit deiner E-Mail-Adresse und dem neuen Passwort an und findest oben im Menü den Admin-Bereich.",
      ].join("\n\n"),
      buttonLabel: "Passwort festlegen",
      footer: "Ist der Link abgelaufen, kannst du auf der Anmeldeseite über „Passwort vergessen?“ jederzeit einen neuen anfordern.",
    },
  },
  student_invite: {
    label: "Einladung zu einem Kurs",
    group: "Konto",
    description: "Wenn ein Admin oder eine Lehrkraft jemanden per E-Mail zu einem Kurs einlädt.",
    placeholders: [
      { key: "name", label: "Name der eingeladenen Person", example: "Fatima" },
      KURS,
      { key: "von", label: "Name der einladenden Person", example: "Ustadh Yusuf" },
      { key: "hinweis", label: "Hinweis zur Bezahlung (ohne Zahlung bzw. normale Anmeldung)", example: "Die Teilnahme ist für dich kostenlos." },
      { key: "link", label: "Einladungslink (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/einladung/…" },
      { key: "tage", label: "Gültigkeit des Links in Tagen", example: "14" },
      {
        ...TRIAL_SAMPLE,
        example: TRIAL_SAMPLE.example.replace("vor der Probestunde", "möglichst bald, gern schon vor der Anmeldung,"),
      },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Einladung zum Kurs „{{kurs}}“",
      body: [
        GREETING,
        "{{von}} lädt dich zum Kurs **{{kurs}}** bei Islam unter Freunden ein. {{hinweis}}",
        "Über diesen Link meldest du dich an. Hast du noch kein Konto, legst du dabei eines an. Der Link ist {{tage}} Tage gültig:",
        "{{button}}",
        "{{hoerprobe}}",
      ].join("\n\n"),
      buttonLabel: "Einladung annehmen",
      footer: CONTACT_FOOTER,
    },
  },
  staff_notification: {
    label: "Benachrichtigung an Lehrkraft oder Admin",
    group: "Benachrichtigungen",
    description:
      "Wenn im Kurs etwas passiert (z. B. neue Anmeldung, Kündigung, Leseprobe) an die Lehrkraft, bei fehlgeschlagenen Zahlungen an die Admins. Wer was per E-Mail bekommt, stellt jede Person unter „Benachrichtigungen“ selbst ein.",
    placeholders: [
      { key: "name", label: "Name der Lehrkraft bzw. des Admins", example: "Ustadh Yusuf" },
      { key: "titel", label: "Kurze Überschrift des Ereignisses", example: "Neue Anmeldung: Tajweed für Anfänger" },
      { key: "details", label: "Beschreibung des Ereignisses", example: "Ali (Konto: Fatima Yilmaz) ist jetzt im Kurs „Tajweed für Anfänger“ eingeschrieben." },
      { key: "link", label: "Link zur passenden Seite im Lehrer- bzw. Admin-Bereich (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/teacher/benachrichtigungen" },
      { key: "einstellungen", label: "Link zu den Benachrichtigungs-Einstellungen", example: "https://www.islamunterfreunden.de/teacher/benachrichtigungen/einstellungen" },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "{{titel}}",
      body: [GREETING, "{{details}}", "{{button}}"].join("\n\n"),
      buttonLabel: "Ansehen",
      footer: "Diese E-Mail wurde automatisch verschickt. Welche Ereignisse du per E-Mail bekommst, stellst du hier ein: {{einstellungen}}",
    },
  },
  trial_invite: {
    label: "Einladung zur Probestunde",
    group: "Probestunde",
    description:
      "Wenn eine Lehrkraft oder ein Admin jemanden zu einer kostenlosen Probestunde einlädt. Mit Kalendereintrag im Anhang.",
    placeholders: [
      { key: "name", label: "Name der eingeladenen Person", example: "Yusuf" },
      KURS,
      LEHRER,
      { key: "datum", label: "Datum und Uhrzeit der Probestunde", example: "Freitag, 14. November 2026 um 18:00 Uhr (deutsche Zeit)" },
      { key: "dauer", label: "Dauer in Minuten", example: "30" },
      { key: "link", label: "Link zum Unterrichtsraum (Ziel des Buttons)", example: "https://meet.jit.si/islamunterfreunden-probestunde-abc123" },
      TRIAL_SAMPLE,
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Einladung zur Probestunde: „{{kurs}}“",
      body: [
        GREETING,
        "{{lehrer}} lädt dich zu einer kostenlosen Probestunde im Kurs **{{kurs}}** ein.",
        "**Wann:** {{datum}}\n**Dauer:** {{dauer}} Minuten",
        "Zur Probestunde kommst du über diesen Link, ein Konto brauchst du nicht. Den Termin findest du auch im Anhang für deinen Kalender. Wir erinnern dich einen Tag und eine Stunde vorher.",
        "{{button}}",
        "{{hoerprobe}}",
      ].join("\n\n"),
      buttonLabel: "Zur Probestunde",
      footer: CONTACT_FOOTER,
    },
  },
  trial_reminder: {
    label: "Erinnerung an die Probestunde",
    group: "Probestunde",
    description: "Automatisch 24 Stunden und 1 Stunde vor der Probestunde an alle eingeladenen Personen.",
    placeholders: [
      { key: "name", label: "Name der eingeladenen Person", example: "Yusuf" },
      KURS,
      { key: "wann", label: "„morgen“ oder „in einer Stunde“", example: "morgen" },
      { key: "datum", label: "Datum und Uhrzeit der Probestunde", example: "Freitag, 14. November 2026 um 18:00 Uhr (deutsche Zeit)" },
      { key: "link", label: "Link zum Unterrichtsraum (Ziel des Buttons)", example: "https://meet.jit.si/islamunterfreunden-probestunde-abc123" },
      { ...TRIAL_SAMPLE, label: "Erinnerung an die erbetene Hörprobe, falls sie noch fehlt (nur 24 Stunden vorher, sonst leer)" },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Erinnerung: Probestunde „{{kurs}}“ {{wann}}",
      body: [GREETING, "deine Probestunde im Kurs **{{kurs}}** ist {{wann}}.", "**Wann:** {{datum}}", "{{button}}", "{{hoerprobe}}"].join("\n\n"),
      buttonLabel: "Zur Probestunde",
      footer: CONTACT_FOOTER,
    },
  },
  trial_cancelled: {
    label: "Probestunde abgesagt",
    group: "Probestunde",
    description: "Wenn eine Probestunde unter „Termine“ abgesagt wird, an alle eingeladenen Personen.",
    placeholders: [
      { key: "name", label: "Name der eingeladenen Person", example: "Yusuf" },
      KURS,
      { key: "datum", label: "Datum und Uhrzeit der abgesagten Probestunde", example: "Freitag, 14. November 2026 um 18:00 Uhr (deutsche Zeit)" },
    ],
    hasButton: false,
    defaults: {
      subject: "Probestunde abgesagt: „{{kurs}}“",
      body: [
        GREETING,
        "die Probestunde im Kurs **{{kurs}}** am {{datum}} muss leider ausfallen. Die Lehrkraft meldet sich mit einem neuen Termin bei dir.",
      ].join("\n\n"),
      buttonLabel: "",
      footer: CONTACT_FOOTER,
    },
  },
  sample_request: {
    label: "Bitte um eine Hörprobe",
    group: "Kurs und Termine",
    description:
      "Wenn eine Lehrkraft unter „Nachrichten“ bei Teilnehmern ihres Kurses eine Hörprobe anfordert. Der Button führt zur Aufnahme-Seite.",
    placeholders: [
      NAME,
      KURS,
      LEHRER,
      { key: "abschnitt", label: "Erbetener Abschnitt (Sure und Verse)", example: "Sure 67 Al-Mulk, Verse 1–10" },
      { key: "hinweis", label: "Persönlicher Hinweis der Lehrkraft (leer, wenn keiner angegeben ist)", example: "Achte besonders auf die Madd-Regeln." },
      { key: "link", label: "Link zur Aufnahme-Seite (Ziel des Buttons)", example: "https://www.islamunterfreunden.de/dashboard/kurse/abc/leseprobe" },
      BUTTON,
    ],
    hasButton: true,
    defaults: {
      subject: "Bitte um eine Hörprobe: {{abschnitt}}",
      body: [
        GREETING,
        "bitte lies **{{abschnitt}}** laut vor und nimm es als Hörprobe auf. So kann ich mich gezielt auf die nächste Stunde im Kurs **{{kurs}}** vorbereiten.",
        "{{hinweis}}",
        "{{button}}",
        "Viele Grüße\n{{lehrer}}",
      ].join("\n\n"),
      buttonLabel: "Hörprobe aufnehmen",
      footer: ENROLLED_FOOTER,
    },
  },
} as const satisfies Record<string, TemplateDefinition>;

export type EmailTemplateKey = keyof typeof EMAIL_TEMPLATES;

// Werte, die der Code beim Versand fuer eine Mail liefern muss ({{button}} setzt der Renderer).
export type EmailValues<K extends EmailTemplateKey> = Record<
  Exclude<(typeof EMAIL_TEMPLATES)[K]["placeholders"][number]["key"], "button">,
  string
>;

export const EMAIL_GROUPS = ["Kurs und Termine", "Zahlung und Abo", "Warteliste", "Konto", "Probestunde", "Benachrichtigungen"] as const;

// Wert fuer {{hinweis}} in der Kurseinladung (auch fuer die Vorschau im Browser).
export const STUDENT_INVITE_HINTS = {
  free: "Die Teilnahme ist für dich kostenlos.",
  paid: "Die Anmeldung und Bezahlung erledigst du direkt über den Link.",
} as const;

// Mails, die eine Lehrkraft selbst ausloest. Fuer diese kann sie eigene Vorlagen speichern
// (Lehrer-Bereich "Mailvorlagen") und sieht vor dem Versand eine Vorschau.
export const TEACHER_EMAIL_KEYS = [
  "student_invite",
  "trial_invite",
  "sample_request",
  "trial_cancelled",
  "session_moved",
  "session_cancelled",
  "participant_removed",
  "waitlist_offer",
] as const satisfies readonly EmailTemplateKey[];
export type TeacherEmailKey = (typeof TEACHER_EMAIL_KEYS)[number];

export function isTeacherEmailKey(key: string): key is TeacherEmailKey {
  return (TEACHER_EMAIL_KEYS as readonly string[]).includes(key);
}

// HTML-Bausteine, die in einem angepassten Text nicht fehlen duerfen (z. B. die Bitte um die
// Hoerprobe mit dem persoenlichen Link). Fehlt der Platzhalter, wird er angehaengt.
const REQUIRED_BLOCKS: Partial<Record<EmailTemplateKey, string>> = {
  student_invite: "hoerprobe",
  trial_invite: "hoerprobe",
  trial_reminder: "hoerprobe",
};

export function withRequiredBlocks(key: EmailTemplateKey, content: EmailContent): EmailContent {
  const block = REQUIRED_BLOCKS[key];
  if (!block || new RegExp(`\\{\\{\\s*${block}\\s*\\}\\}`).test(content.body)) return content;
  return { ...content, body: `${content.body}\n\n{{${block}}}` };
}

export function isEmailTemplateKey(key: string): key is EmailTemplateKey {
  return Object.prototype.hasOwnProperty.call(EMAIL_TEMPLATES, key);
}

export function getTemplateDefinition(key: EmailTemplateKey): TemplateDefinition {
  return EMAIL_TEMPLATES[key];
}

export function exampleValues(key: EmailTemplateKey): Record<string, string> {
  return Object.fromEntries(getTemplateDefinition(key).placeholders.map((p) => [p.key, p.example]));
}
