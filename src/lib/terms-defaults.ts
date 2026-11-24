// Entwuerfe fuer AGB und Widerrufsbelehrung (gleiches Format wie legal-defaults.ts). Sie beschreiben
// nur, was die Website tatsaechlich tut, ersetzen keine Rechtsberatung und muessen geprueft werden.

export const OPERATOR = {
  name: "Sufipfad der Liebe e. V.",
  address: "Rasenmühle 1, 34466 Wolfhagen",
  email: "admin@islamunterfreunden.de",
  phone: "0178 1667861",
};

export const TERMS_TEXT = [
  "## 1. Anbieter und Geltung",
  `Diese Bedingungen gelten für Kurse, die über diese Website gebucht werden. Anbieter und Vertragspartner ist der ${OPERATOR.name}, ${OPERATOR.address} (siehe Impressum).`,
  "## 2. Leistung",
  "Wir bieten Online-Unterricht in kleinen Gruppen an, vor allem Quran-Rezitation und islamische Wissenschaften. Der Unterricht findet live per Videokonferenz statt. Inhalt, Lehrkraft, Termine und Teilnehmerzahl stehen beim jeweiligen Kurs. Für die Teilnahme brauchst du ein internetfähiges Gerät mit Ton, am besten auch mit Kamera.",
  "## 3. Konto und Anmeldung",
  "Ein Konto können nur Volljährige anlegen. Sie können sich selbst, ihre Kinder und andere erwachsene Personen anmelden. Mit dem Abschluss der Zahlung kommt der Vertrag zustande; danach erhältst du eine Bestätigung per E-Mail. Die Bestätigung und die Bedingungen kannst du speichern.",
  "## 4. Preise und Zahlung",
  "Es gelten die Preise, die vor der Zahlung angezeigt werden. Je nach Kurs fallen eine einmalige Anmeldegebühr, ein monatlicher Beitrag oder beides an. Die Zahlung läuft über den Zahlungsdienst Stripe. Monatliche Beiträge werden zu Beginn jedes Abrechnungsmonats eingezogen.",
  "## 5. Laufzeit und Kündigung",
  "Abos haben keine Mindestlaufzeit. Du kannst jederzeit zum Ende des laufenden Abrechnungsmonats kündigen, online im Konto unter „Abo verwalten“ oder per E-Mail. Das Recht zur Kündigung aus wichtigem Grund bleibt unberührt.",
  "## 6. Ausgefallene Stunden",
  "Fällt eine Stunde von unserer Seite aus oder wird sie verschoben, informieren wir dich per E-Mail und bieten nach Möglichkeit einen Ersatztermin an. Deine gesetzlichen Rechte bleiben unberührt.",
  "## 7. Widerruf und Erstattung",
  "Verbraucher haben ein gesetzliches Widerrufsrecht. Einzelheiten stehen auf der Seite „Widerruf“. Erstattungen erfolgen über die Zahlungsart, mit der du bezahlt hast.",
  "## 8. Umgang miteinander und Inhalte",
  "Zugangslinks sind persönlich und dürfen nicht weitergegeben werden. Aufnahmen des Unterrichts durch Teilnehmer sind nur mit Zustimmung aller Beteiligten erlaubt. Lernmaterial ist nur für den eigenen Gebrauch bestimmt.",
  "## 9. Haftung",
  "Wir haften nach den gesetzlichen Vorschriften.",
  "## 10. Schlussbestimmungen",
  "Es gilt deutsches Recht. Zwingende Verbraucherschutzvorschriften des Staates, in dem du lebst, bleiben unberührt.",
].join("\n\n");

export const WITHDRAWAL_TEXT = [
  "## Widerrufsrecht",
  "Du hast das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen. Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.",
  `Um dein Widerrufsrecht auszuüben, musst du uns (${OPERATOR.name}, ${OPERATOR.address}, Telefon: ${OPERATOR.phone}, E-Mail: ${OPERATOR.email}) mittels einer eindeutigen Erklärung (z. B. ein mit der Post versandter Brief oder eine E-Mail) über deinen Entschluss, diesen Vertrag zu widerrufen, informieren. Du kannst dafür das Muster-Widerrufsformular unten verwenden, das jedoch nicht vorgeschrieben ist.`,
  "Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absendest.",
  "## Folgen des Widerrufs",
  "Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich und spätestens binnen vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf dieses Vertrags bei uns eingegangen ist. Für diese Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden dir wegen dieser Rückzahlung Entgelte berechnet.",
  "Hast du verlangt, dass die Dienstleistung während der Widerrufsfrist beginnen soll, so hast du uns einen angemessenen Betrag zu zahlen, der dem Anteil der bis zu dem Zeitpunkt, zu dem du uns von der Ausübung des Widerrufsrechts hinsichtlich dieses Vertrags unterrichtest, bereits erbrachten Dienstleistungen im Vergleich zum Gesamtumfang der im Vertrag vorgesehenen Dienstleistungen entspricht.",
  "## Muster-Widerrufsformular",
  "(Wenn du den Vertrag widerrufen willst, fülle bitte dieses Formular aus und sende es zurück.)",
  `An ${OPERATOR.name}, ${OPERATOR.address}, E-Mail: ${OPERATOR.email}:\n\nHiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über die Erbringung der folgenden Dienstleistung:`.replace("\n\n", "\n"),
  "Bestellt am:\nName des/der Verbraucher(s):\nAnschrift des/der Verbraucher(s):\nUnterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):\nDatum:",
  "(*) Unzutreffendes streichen.",
].join("\n\n");
