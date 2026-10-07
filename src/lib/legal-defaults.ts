// Standardtexte fuer Impressum und Datenschutzerklaerung. Sie werden angezeigt, solange
// im Admin-Bereich kein eigener Text hinterlegt ist. Format: Absaetze durch Leerzeilen
// getrennt, Absaetze mit "## " am Anfang sind Zwischenueberschriften.
//
// Die Texte sind ein Entwurf auf Basis der tatsaechlich eingesetzten Dienste und
// ersetzen keine Rechtsberatung. Angaben in [eckigen Klammern] muessen ergaenzt werden.

export const DEFAULT_IMPRESSUM = [
  "## Angaben gemäß § 5 DDG",
  "[Name der Organisation bzw. vollständiger Name, ggf. Rechtsform, z. B. e. V.]\n[Straße und Hausnummer]\n[PLZ und Ort]",
  "## Kontakt",
  "E-Mail: admin@islamunterfreunden.de\n[Telefonnummer, falls vorhanden]",
  "## Vertretungsberechtigt",
  "[Name der vertretungsberechtigten Person(en), bei Vereinen: Vorstand]",
  "## Registereintrag",
  "[Falls vorhanden: Registergericht und Registernummer, z. B. Vereinsregister]",
  "## Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV",
  "[Name und Anschrift der verantwortlichen Person]",
].join("\n\n");

const VIDEO_JITSI = [
  "## 8. Online-Unterricht (Jitsi Meet)",
  "Für den Unterricht nutzen wir Jitsi Meet über meet.jit.si (8x8, Inc., USA). Beim Beitritt zu einer Sitzung werden unter anderem IP-Adresse, Geräteinformationen, dein angezeigter Name sowie Audio und Video verarbeitet, soweit du Kamera und Mikrofon freigibst. Die Verbindung zu Jitsi entsteht erst, wenn du einer Sitzung beitrittst. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Eine Aufzeichnung des Unterrichts findet derzeit nicht statt; sollte sich das ändern, informieren wir vorab.",
];

const VIDEO_ZOOM = [
  "## 8. Online-Unterricht (Zoom)",
  "Für den Unterricht nutzen wir Zoom (Zoom Video Communications, Inc., 55 Almaden Boulevard, San Jose, CA 95113, USA). Beim Beitritt zu einer Sitzung werden unter anderem IP-Adresse, Geräteinformationen, dein angezeigter Name sowie Audio und Video verarbeitet, soweit du Kamera und Mikrofon freigibst. Zoom kann Daten auch in den USA verarbeiten; die Übermittlung erfolgt auf Grundlage des EU-US Data Privacy Framework bzw. von Standardvertragsklauseln. Mit Zoom besteht ein Vertrag zur Auftragsverarbeitung. Die Verbindung zu Zoom entsteht erst, wenn du einer Sitzung beitrittst. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Eine Aufzeichnung des Unterrichts findet derzeit nicht statt; sollte sich das ändern, informieren wir vorab.",
];

// Der Abschnitt zum Online-Unterricht nennt je nach CLASSROOM_PROVIDER Zoom oder Jitsi.
export function defaultPrivacyPolicy(zoom: boolean) {
  return [
  "## 1. Verantwortlicher",
  "Verantwortlich für die Datenverarbeitung auf dieser Website ist der im Impressum genannte Anbieter. Kontakt für Datenschutzfragen: admin@islamunterfreunden.de.",

  "## 2. Überblick",
  "Wir verarbeiten personenbezogene Daten nur, soweit das für den Betrieb der Website und unser Unterrichtsangebot erforderlich ist. Wir setzen keine Analyse- und Werbe-Tracker ein.",

  "## 3. Hosting und Server-Logfiles",
  "Die Website wird bei Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA, betrieben. Beim Aufruf der Seiten werden technisch notwendige Daten (IP-Adresse, Datum und Uhrzeit, aufgerufene Seite, Browsertyp) in Server-Logfiles verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (sicherer und stabiler Betrieb). Eine Übermittlung in die USA erfolgt auf Grundlage des EU-US Data Privacy Framework bzw. von Standardvertragsklauseln.",

  "## 4. Datenbank",
  "Konten, Kurse, Anmeldungen und Termine speichern wir in einer Datenbank (Prisma Postgres, Rechenzentrum in Frankfurt am Main).",

  "## 5. Benutzerkonto und Anmeldung",
  "Bei der Registrierung verarbeiten wir deinen Namen, deine E-Mail-Adresse und dein Passwort (nur in verschlüsselter Form als Hash). Zweck ist die Bereitstellung des geschützten Bereichs und des Zugangs zu deinen Kursen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Die Daten werden bis zur Löschung des Kontos gespeichert.\n\nFür die Anmeldung setzen wir ein technisch notwendiges Cookie (Sitzungs-Cookie) ein. Es dient ausschließlich dazu, dich eingeloggt zu halten; dafür ist nach § 25 Abs. 2 Nr. 2 TDDDG keine Einwilligung erforderlich. Weitere Cookies, insbesondere zu Analyse- oder Werbezwecken, setzen wir nicht.",

  "## 6. Kursanmeldung und Zahlung",
  "Kurse werden als Abonnement über Stripe abgewickelt (Stripe Payments Europe, Ltd., 1 Grand Canal Street Lower, Grand Canal Dock, Dublin, Irland, ggf. Stripe, Inc., USA). Deine Zahlungsdaten gibst du direkt bei Stripe ein; wir erhalten keine Kartendaten, sondern nur Angaben wie den Abo-Status. Rechtsgrundlage sind Art. 6 Abs. 1 lit. b DSGVO (Vertrag) und lit. c DSGVO (steuer- und handelsrechtliche Aufbewahrungspflichten).",

  "## 7. E-Mail-Versand",
  "Für den Versand von E-Mails nutzen wir Resend (Resend, Inc., USA). Wir senden dir Erinnerungen vor Kursterminen sowie Mitteilungen und Kursmaterial deiner Lehrer zu Kursen, in die du eingeschrieben bist. Verarbeitet werden dein Name, deine E-Mail-Adresse und der Kurs. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO. Werbliche E-Mails versenden wir nur mit deiner Einwilligung.",

  ...(zoom ? VIDEO_ZOOM : VIDEO_JITSI),

  "## 9. Terminbuchung (Calendly)",
  "Kostenlose Beratungsgespräche kannst du über Calendly buchen (Calendly LLC, USA). Der Link führt auf eine Seite von Calendly; erst dort werden Daten (z. B. Name, E-Mail-Adresse, gewählter Termin) an Calendly übermittelt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen). Weitere Informationen findest du in den Datenschutzhinweisen von Calendly.",

  "## 10. Schriftarten und Bilder",
  "Schriftarten und Bilder, auch die abgebildeten Miniaturen, werden von unserem eigenen Server ausgeliefert. Es werden dabei keine Verbindungen zu Google Fonts oder anderen Drittanbietern aufgebaut.",

  "## 11. Speicherdauer",
  "Wir löschen personenbezogene Daten, sobald der Zweck entfällt, spätestens mit der Löschung deines Kontos, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.",

  "## 12. Kinder und Jugendliche",
  "Unsere Kurse richten sich teilweise an Kinder und Jugendliche. Konten und Anmeldungen für Kinder unter 16 Jahren sollen durch die Erziehungsberechtigten erfolgen.",

  "## 13. Deine Rechte",
  "Du hast das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21). Erteilte Einwilligungen kannst du jederzeit widerrufen. Wende dich dazu an admin@islamunterfreunden.de. Außerdem hast du das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. Zuständig ist: [zuständige Landesdatenschutzbehörde ergänzen].",

  "## 14. Stand",
  "Oktober 2026. Wir passen diese Erklärung an, wenn sich unser Angebot oder die Rechtslage ändert.",
  ].join("\n\n");
}
