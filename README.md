# Quran Madrasa (Arbeitstitel)

Online-Plattform für Quran-Unterricht (Tadschwid, Hifz) und islamische Wissenschaften:
Kursangebot durchstöbern, monatlich kündbares Abo abschließen, per Jitsi Meet am Unterricht
teilnehmen.

## Tech-Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript** + **Tailwind CSS**
- **PostgreSQL** + **Prisma** als ORM
- **Auth.js / NextAuth v5** (Credentials-Login) für Nutzer-Accounts (Rollen: `STUDENT`,
  `TEACHER`, `ADMIN`). Aktuell als `5.0.0-beta.x` gepinnt, da es (Stand jetzt) noch keinen
  finalen v5-Release gibt – die Kern-APIs sind aber stabil und breit im Einsatz.
- **Stripe** (Checkout + Billing Portal) für monatlich kündbare Abos
- Routen-Schutz über `src/proxy.ts` (Next.js 16 hat `middleware.ts` in `proxy.ts`
  umbenannt) + den `authorized`-Callback in `src/auth.config.ts`
- Unterricht über **automatisch generierte Jitsi-Meet-Links** (kostenlos, keine Zeit-/
  Teilnehmerlimits, kein Account nötig – öffentliche Instanz meet.jit.si, siehe
  `src/lib/jitsi.ts`) pro Kurssitzung; Lehrer können optional einen eigenen Link
  eintragen. Die Klassenraum-Logik liegt hinter einer Abstraktion
  (`ClassSession.classroomType`), damit später ein eigener, selbst gehosteter
  Online-Klassenraum mit Tafel-Funktion ergänzt werden kann, ohne das Datenmodell oder
  bestehende Seiten zu ändern.

## Funktionsumfang (MVP)

- Startseite listet das veröffentlichte Kursangebot, gruppiert nach Kategorie
- Kurs-Detailseite mit Beschreibung, Preis/Monat, "Jetzt abonnieren"
- Registrierung/Login
- Stripe Checkout (Subscription) → nach Zahlung automatische Freischaltung (`Enrollment`)
  über Webhook
- Stripe Customer Portal → Nutzer können ihr Abo selbst monatlich kündigen oder
  Zahlungsdaten ändern
- Schüler-Dashboard: eigene Kurse + kommende Sitzungen + "Klasse beitreten"
- Lehrer-Bereich: Kurse anlegen/veröffentlichen, einzelne oder wiederkehrende Sitzungen
  mit automatischem Jitsi-Link anlegen
- E-Mail-Erinnerungen (24h vorher, 1h vorher, bei Kursbeginn) über Resend, getaktet durch einen
  GitHub-Actions-Workflow (`.github/workflows/send-reminders.yml`), der alle 15 Minuten
  `/api/cron/send-reminders` aufruft (Vercels Hobby-Plan erlaubt Cron Jobs nur 1x täglich,
  daher dieser Umweg)
- Lehrer können Kursmaterial (Lernmaterial, Hausaufgaben, Ankündigungen) per E-Mail an alle
  eingeschriebenen Teilnehmer eines Kurses verschicken, über einen eigenen Absender
  (`RESEND_MATERIAL_FROM_EMAIL`), getrennt von den automatischen Erinnerungen
- Stundenplan (`/stundenplan`) im Stil der Vorlagen-Grafik: Wochenraster mit farbigen
  Kurs-Blöcken und Icons (ab 1024 px Breite), auf Handy/schmalen Fenstern pro Tag eine
  Karte mit den Terminen untereinander; dazu Legende, Fußnoten und PDF-Download
  (`/stundenplan/pdf`, erzeugt mit `pdf-lib`). Die Zeiten der Stundenplan-Einträge (`ScheduleSlot`) sind in Ortszeit Nordzypern (UTC+3, ganzjährig)
  gespeichert und werden für die Anzeige in deutsche Zeit umgerechnet
  (`src/lib/schedule-time.ts`) – die Verschiebung wechselt daher mit der deutschen
  Zeitumstellung zwischen 1 und 2 Stunden. Seiten mit Zeitangaben werden stündlich neu
  erzeugt (`revalidate = 3600`), damit sie nach der Zeitumstellung nicht veraltet bleiben.
  Im Lehrer-Bereich sind neue Zeiten deshalb ebenfalls in Ortszeit einzutragen.
- Schlichte, klare Gestaltung (Orientierung: Adab Academy, ohne Kopie): warmes Weiß, dunkles
  Grün und tiefes Himmelblau, Antiqua-Überschriften (Cormorant Garamond über `next/font`,
  selbst gehostet), Zierlinien. Die Kurse tragen persische Miniaturen (Wikimedia Commons,
  gemeinfrei bzw. CC0, verkleinert unter `public/images/miniatures/`) als quadratisches Bild
  auf Kurskarten und Kursseite; Zuordnung und Quellen in `src/lib/miniatures.ts` und auf
  `/bildnachweis`. Der Stundenplan nutzt stattdessen stilisierte Icons (Buchständer mit Quran,
  Buch, Moschee) zentriert in den Blöcken. Auf dem Handy öffnet sich die Navigation als
  Burger-Menü.
- Quran-Unterseite (`/quran`): Zitat von Maulana Sheikh Muhammad Adil Ar-Rabbani ohne Hintergrund,
  in der Kursive EB Garamond (echte Kursive) und mit goldenen Eck-Ornamenten (Bild unter
  `public/images/ornaments/`, scharfer 90°-Winkel, für die anderen Ecken gespiegelt) bündig zum
  Seiteninhalt; Bildkasten mit Einführungstext und
  drei Spalten für die Level mit Links zu den Kursen. Der Startseiten-Slide „Quran-Unterricht für
  alle Level“ führt dorthin: Hero in voller Breite, das Manuskriptblatt liegt in Perspektive
  schräg von oben gesehen und läuft oben in Blau und Unschärfe aus; langsame Ken-Burns-Animation
  (respektiert `prefers-reduced-motion`). Unter „Kursangebot“ gibt es ein Untermenü mit den
  Kursthemen (auf Handy und Tablets im Burger-Menü). Titelbild: Blatt aus dem „Blauen Quran“
  (Met, CC0), Quellenangabe auf `/bildnachweis` und im Impressum.
- Schreibweise: einheitlich **Quran** (nicht Qur'an/Koran), auch in Kurstiteln und Kategorien. Die
  bestehenden Kurse wurden per Migration angepasst; der Text der Lehrer-Biografie bleibt
  unverändert.
- Rechtstexte: `/impressum` und `/datenschutz` (im Footer verlinkt). Die Texte sind im
  Admin-Bereich pflegbar (`SiteContent.impressum` / `privacyPolicy`); ohne gespeicherten Text
  erscheint der Standard-Entwurf aus `src/lib/legal-defaults.ts`. Angaben in [eckigen
  Klammern] müssen ergänzt werden, und die Texte sollten juristisch geprüft werden. Bei der
  Registrierung ist ein Häkchen für die Datenschutzerklärung Pflicht.
- Kurse ohne Stripe-Preis (`stripePriceId`) zeigen statt des Anmelde-Buttons den Hinweis
  „Anmeldung auf Anfrage“, ein Preis von 0 € wird als „Preis auf Anfrage“ angezeigt
- Zwei getrennte Layouts: die öffentliche Marketing-Seite (`src/app/(site)/`, Nav + zentrierte
  Spalte) für Schüler/Besucher, und eine eigene App-Shell mit linker Sidebar
  (`src/app/(app)/`) für Lehrer- und Admin-Bereich – beide Route-Groups ändern nichts an den
  URLs, nur am Layout

## Videokonferenz: Jitsi oder Zoom

Für jede Sitzung wird automatisch ein Meeting-Link erzeugt. Welcher Dienst dafür genutzt wird,
steuert die Umgebungsvariable `CLASSROOM_PROVIDER`:

- `jitsi` (Standard, kostenlos): Jitsi-Link über meet.jit.si.
- `zoom`: Zoom-Meeting im Zoom-Konto des Lehrers (braucht mindestens den Tarif **Zoom Pro**, weil
  Basic-Meetings nach 40 Minuten enden).

Bereits angelegte Sitzungen behalten ihren Link, ein Wechsel ist jederzeit in beide Richtungen
möglich. Ein manuell eingetragener Link überschreibt die automatische Erzeugung immer.

### Zoom einrichten

1. Zoom Pro buchen (zoom.us/pricing). Pro Lehrer, der Meetings leitet, wird eine Lizenz benötigt;
   Schüler brauchen weder Konto noch Lizenz.
2. Im [Zoom App Marketplace](https://marketplace.zoom.us) (mit dem Zoom-Konto anmelden):
   *Develop → Build App → Server-to-Server OAuth*. Name z. B. „Quran Madrasa“. Auf der Seite
   „App Credentials“ stehen **Account ID**, **Client ID** und **Client Secret**.
3. Unter *Scopes* den Bereich zum Anlegen von Meetings hinzufügen (Meeting: „Create/View and
   manage user meetings“, technisch `meeting:write:meeting:admin`), dann die App **aktivieren**.
4. In Vercel (Settings → Environment Variables) setzen und danach neu deployen:
   `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` (als Secret),
   `ZOOM_HOST_EMAIL` (E-Mail des Zoom-Kontos des Lehrers) und `CLASSROOM_PROVIDER=zoom`.
5. Optional im Admin-Bereich beim jeweiligen Lehrer ein eigenes „Zoom-Konto“ eintragen. Das ist
   nötig, sobald mehrere Lehrer eigene Zoom-Lizenzen haben; sonst gilt `ZOOM_HOST_EMAIL`.
6. Testen: im Lehrer-Bereich eine Sitzung anlegen. Der Link sollte jetzt auf zoom.us zeigen, und
   das Meeting erscheint in der Zoom-App des Lehrers.

Zeiten von Sitzungen werden in Ortszeit Nordzypern (UTC+3) eingegeben, intern als echter
UTC-Zeitpunkt gespeichert und Schülern in deutscher Zeit angezeigt (Dashboard, Erinnerungs-Mails).
Datenschutz: Mit Zoom muss ein Vertrag zur Auftragsverarbeitung bestehen; der Standardtext der
Datenschutzerklärung nennt automatisch Zoom bzw. Jitsi passend zu `CLASSROOM_PROVIDER`.

## Anmeldung zu Kursen: Teilnehmer und Abos

Wer sich anmeldet, legt zuerst ein Konto an (nur Erwachsene). Beim Klick auf „Jetzt anmelden“ im
Kurs folgt ein Assistent unter `/courses/<kurs>/anmelden`: Wen meldest du an – dich selbst, Kinder
(unter 18, mit Bestätigung der Sorgeberechtigung) oder andere Erwachsene? Danach prüft man die
Angaben und startet mit „Zahlungspflichtig anmelden“ die Stripe-Zahlung.

- Ein Konto kann mehrere **Teilnehmer** haben (Tabelle `Participant`). Der Konto-Inhaber bezahlt,
  muss aber nicht selbst teilnehmen. Pro Kurs und Zahlung gibt es **ein** Stripe-Abo, dessen Menge
  der Zahl der Teilnehmer entspricht.
- Eingeschrieben wird erst nach erfolgreicher Zahlung, durch den Stripe-Webhook
  (`src/lib/subscription-sync.ts`). Endet oder wird das Abo gekündigt, entfallen die Einschreibungen
  dieses Abos.
- Mails (Erinnerungen, Kursmaterial) gehen an die E-Mail-Adresse des Teilnehmers, bei Kindern ohne
  eigene Adresse an den Konto-Inhaber. Optionale WhatsApp-Nummern werden nur mit Einwilligung
  gespeichert und erscheinen der Lehrkraft im Kurs unter „WhatsApp-Gruppe des Kurses“.
- Im **Stripe-Kundenportal** sollte die Änderung der Menge ausgeschaltet bleiben (Dashboard →
  Einstellungen → Kundenportal → Abos), sonst ändert sich die Teilnehmerzahl nur in Stripe und nicht
  in der Datenbank. Abos lassen sich als Ganzes kündigen.

## Mediathek und E-Mails an Teilnehmer

Lehrer legen unter `/teacher/mediathek` Lehrmaterial ab (PDF, Bilder, Office-Dateien u. a.) und
schreiben unter `/teacher/emails` (oder auf der Kursseite) an alle oder einzelne Teilnehmer eines
Kurses, optional mit Dateien aus der Mediathek.

- **Ohne Blob-Speicher** liegen die Dateien in der Datenbank (Tabelle `MediaFile`), höchstens
  4 MB je Datei (Vercel nimmt pro Anfrage nur ca. 4,5 MB an).
- **Mit Vercel Blob** lädt der Browser die Datei direkt in den Speicher (bis 200 MB). So richtest
  du es ein:
  1. Im Vercel-Projekt *Storage → Create Database → Blob*, einen Speicher anlegen und mit dem
     Projekt verbinden. Vercel setzt `BLOB_READ_WRITE_TOKEN` automatisch.
  2. Wenn der Speicher als **privat** angelegt wird (empfohlen), nichts weiter tun. Bei einem
     öffentlichen Speicher zusätzlich `BLOB_ACCESS=public` setzen.
  3. Neu deployen. Die Mediathek schaltet selbst auf Blob um. Bereits in der Datenbank liegende
     Dateien funktionieren weiter.
- Dateien bis 5 MB gehen als **Anhang** mit der E-Mail, größere als **Download-Link**, der 90 Tage
  gültig ist (signiert, ohne Anmeldung nutzbar). Alle Anhänge zusammen: höchstens 10 MB.
- Im Hobby-Tarif von Vercel ist Blob nur begrenzt kostenlos (u. a. 1 GB Speicher); bei
  Überschreitung ist der Speicher bis zum nächsten Monat gesperrt.

## Anmeldung mit Google (optional)

Registrierung und Anmeldung funktionieren mit E-Mail und Passwort. Zusätzlich kann ein Button
„Mit Google fortfahren“ angeboten werden. Er erscheint automatisch, sobald die beiden Variablen
`AUTH_GOOGLE_ID` und `AUTH_GOOGLE_SECRET` gesetzt sind:

1. In der [Google Cloud Console](https://console.cloud.google.com) ein Projekt anlegen (oder ein
   bestehendes nutzen) und unter *APIs & Dienste → OAuth-Zustimmungsbildschirm* die App
   einrichten (Name, Support-E-Mail, Links zu Datenschutzerklärung und Impressum, Bereiche
   `email`, `profile`, `openid`).
2. Unter *Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID* den Typ „Webanwendung“ wählen
   und als **autorisierte Weiterleitungs-URI** eintragen:
   `https://quran-madrasa.vercel.app/api/auth/callback/google` (bei eigener Domain entsprechend,
   lokal `http://localhost:3000/api/auth/callback/google`).
3. Client-ID und Client-Secret in Vercel als `AUTH_GOOGLE_ID` und `AUTH_GOOGLE_SECRET` setzen und
   neu deployen. Den Zustimmungsbildschirm auf „In Produktion“ stellen, sonst können nur
   Testnutzer sich anmelden.

Wer sich zum ersten Mal mit Google anmeldet, bekommt automatisch ein Konto (Rolle Schüler).
Die Datenschutzerklärung nennt Google automatisch, sobald die Anmeldung aktiv ist.

Passwörter müssen mindestens 10 Zeichen lang sein und dürfen nicht zu den häufigen Passwörtern
gehören (Empfehlung des NIST statt Pflicht-Sonderzeichen). „Passwort vergessen“ verschickt einen
60 Minuten gültigen Einmal-Link per E-Mail; ohne `RESEND_API_KEY` wird er lokal in der Konsole
ausgegeben.

## Testphase: versteckter Kurs, Anmeldegebühr, Benachrichtigungen

### Versteckter Kurs mit geheimem Link

Im Admin-Bereich unter „Alle Kurse“ → „Preis, Plätze und Sichtbarkeit“ lässt sich ein Kurs als
**versteckt** markieren. Er erscheint dann nicht im Kursangebot, im Stundenplan (auch nicht im PDF),
auf der Quran-Seite und auf der Lehrerseite. Erreichbar ist er nur über den geheimen Link
`/zugang/<code>`, der dort angezeigt wird (Kopieren-Button). Der Kurs muss zusätzlich
**veröffentlicht** sein. „Neuen Link erzeugen“ macht den alten Link ungültig. Die Seite ist für
Suchmaschinen gesperrt (`noindex`). Der Zugangscode wird bis zur Zahlung mitgeführt
(`/courses/<kurs>/anmelden?zugang=<code>`), auch über Registrierung und Login hinweg.

### Einmalige Anmeldegebühr (z. B. 5 € und danach 0 € pro Monat)

1. In Stripe ein Produkt für den Kurs mit **zwei Preisen** anlegen: einen **wiederkehrenden**
   Preis (monatlich, z. B. 0,00 €) und einen **einmaligen** Preis (z. B. 5,00 €).
2. Im Admin-Bereich beim Kurs eintragen: Preis pro Monat (0), Stripe-Preis-ID des monatlichen
   Preises, Anmeldegebühr (5) und Stripe-Preis-ID des einmaligen Preises.
3. Beim Checkout zahlt jeder Teilnehmer die Gebühr einmal mit der ersten Rechnung; das Abo läuft
   danach mit 0 € weiter. So werden Verlängerung, Kündigung und alle Benachrichtigungen wie im
   Normalbetrieb durchlaufen.

### Benachrichtigungen

- **Bestätigung nach der Zahlung** an die neu eingeschriebenen Teilnehmer, mit den nächsten
  Terminen (`src/lib/notification-email.ts`, ausgelöst im Webhook über `syncSubscription`).
- **Stunde verschoben oder abgesagt:** Ändert die Lehrkraft Beginn oder Dauer einer kommenden
  Stunde oder löscht sie, bekommen alle Teilnehmer eine Mail.
- **Zahlung fehlgeschlagen** bei einer Verlängerung (`invoice.payment_failed`): Mail an den
  Konto-Inhaber mit Link zu den Zahlungsdaten. Dafür im Stripe-Dashboard beim Webhook das
  Ereignis `invoice.payment_failed` zusätzlich abonnieren. Automatische Wiederholungsversuche
  stellt man in Stripe unter Einstellungen → Billing → Abonnements und E-Mails ein.
- **Rückerstattung:** Erstattungen werden in Stripe gemacht. Soll die Person danach nicht mehr
  teilnehmen, dort auch das Abo kündigen (sofort); der Webhook trägt sie dann aus.

### Kalender-Abo

Im Bereich „Meine Kurse“ gibt es „Kalender abonnieren“ (webcal-Link), einen Download und einen
Link zum Kopieren. Der Link enthält einen persönlichen Schlüssel (`User.calendarToken`) und liefert
alle Termine der eigenen Kurse als iCalendar (`/api/kalender/<schlüssel>.ics`). Verschobene oder
abgesagte Stunden aktualisieren sich beim nächsten Abruf durch die Kalender-App.

### Taktgeber für Erinnerungen (cron-job.org)

GitHub Actions ist bei privaten Repos auf 2.000 Minuten im Monat begrenzt; ein Lauf alle
15 Minuten braucht etwa 2.900. Deshalb übernimmt ein kostenloser externer Dienst den Takt:

1. Auf [cron-job.org](https://cron-job.org) ein Konto anlegen und einen Cronjob erstellen.
2. URL: `https://<domain>/api/cron/send-reminders`, Zeitplan: alle 15 Minuten.
3. Unter „Erweitert“: Anfragemethode **POST**, Header `Authorization` mit dem Wert
   `Bearer <CRON_SECRET>` (derselbe Wert wie in Vercel).
4. Speichern und einmal „Jetzt ausführen“. Im Admin-Bereich steht oben, wann der Taktgeber
   zuletzt geprüft hat; ist das länger als 35 Minuten her, erscheint eine Warnung.
5. Der GitHub-Workflow `.github/workflows/send-reminders.yml` läuft nicht mehr automatisch, er
   bleibt als manueller Notfall-Knopf (GitHub → Actions → „Send Class Reminders“ → „Run
   workflow“). Doppelte Aufrufe schaden nicht, es geht keine Erinnerung doppelt raus.

### Stripe-Konto wechseln (oder von Test auf Live umstellen)

Produkte, Preise, Kunden, Abos und Webhooks gehören immer zu einem Stripe-Konto und einem Modus
(Test oder Live). Beim Wechsel:

1. Im neuen Konto für jeden buchbaren Kurs Produkt und Preise neu anlegen (monatlich und ggf.
   einmalige Gebühr) und die neuen `price_…`-IDs im Admin-Bereich beim Kurs eintragen.
2. Im neuen Konto einen Webhook auf `https://www.islamunterfreunden.de/api/stripe/webhook`
   anlegen, mit `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` und `invoice.payment_failed`.
3. Kundenportal im neuen Konto einrichten (Einstellungen → Billing → Kundenportal: Kündigen
   erlauben, Mengenänderung aus).
4. In Vercel `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` und
   `STRIPE_WEBHOOK_SECRET` durch die Werte des neuen Kontos ersetzen, dann Redeploy.
5. Laufende Abos im alten Konto dort kündigen; sie werden nicht übertragen.

Gespeicherte Stripe-Kunden-IDs aus dem alten Konto werden beim nächsten Checkout automatisch
erkannt und durch einen neuen Kunden im neuen Konto ersetzt (`src/lib/stripe-customer.ts`).

**Kontrolle:** Der Admin-Bereich zeigt oben im Kasten „Stripe-Konto“, über welches Konto die
Website gerade abrechnet, und warnt bei Kurs-Preis-IDs, die es dort nicht gibt.

**Es wird trotzdem noch über das alte Konto abgerechnet?** Dann ist auf Vercel noch der alte
Schlüssel aktiv. Die Website kennt nur den Schlüssel, kein Konto-Login; wer im Stripe-Dashboard
in welchem Konto Mitglied ist, spielt keine Rolle. Typische Ursachen:

- Im Stripe-Dashboard war beim Kopieren noch das alte Konto ausgewählt (Kontoname oben links
  prüfen, dort auf „Camp in Germany“ umschalten, dann Entwickler → API-Schlüssel). Als Mitglied
  mit der Rolle „Entwickler“ siehst du dort den geheimen Schlüssel des neuen Kontos.
- Die Variable wurde in Vercel nur für „Preview“ oder „Development“ geändert, nicht für
  „Production“.
- Nach dem Ändern wurde kein Redeploy gemacht (Vercel → Deployments → letztes Deployment →
  „Redeploy“). Geänderte Variablen gelten erst für neue Deployments.
- Testmodus statt Live: `sk_test_…` rechnet im Testmodus ab, für echte Zahlungen muss der
  Schlüssel mit `sk_live_…` beginnen, und Preise sowie Webhook müssen ebenfalls im Live-Modus
  angelegt sein.

Laufende Abos aus dem alten Konto buchen dort weiter monatlich ab, bis sie im alten Konto
gekündigt werden (Schritt 5); die betroffenen Teilnehmer melden sich danach neu an.

### Vorschau-Modus (Website noch nicht öffentlich)

Ist in Vercel die Variable `SITE_PREVIEW_CODE` gesetzt (z. B. ein zufälliges Wort), sehen
Besucher auf Startseite, Kursangebot, Stundenplan, Kursseiten und „Über uns“ nur eine Seite
„Bald verfügbar“ (`/bald`, für Suchmaschinen gesperrt). Weiterhin erreichbar bleiben: versteckte
Kurse (`/zugang/<code>`) samt Anmeldung und Zahlung, Login und Registrierung, „Meine Kurse“,
Konto, Lehrer- und Admin-Bereich, Lehrerseite sowie Impressum und Datenschutz.

Wer den aktuellen Stand der ganzen Seite sehen soll, öffnet einmal
`https://www.islamunterfreunden.de/?vorschau=<SITE_PREVIEW_CODE>`. Das setzt ein Cookie
(180 Tage), danach ist die Seite in diesem Browser normal sichtbar. Zum Veröffentlichen die
Variable in Vercel löschen und neu deployen.

### Umzug auf die eigene Domain

Beim Wechsel auf die eigene Domain (z. B. `islamunterfreunden.de`) anpassen:

- Vercel: Domain hinzufügen und DNS-Einträge beim Domain-Anbieter setzen
- Vercel-Variablen `NEXT_PUBLIC_APP_URL` und `NEXTAUTH_URL` auf die neue Adresse, dann neu deployen
- Stripe: Webhook-Endpunkt auf `https://<domain>/api/stripe/webhook` (neues Signing Secret in
  `STRIPE_WEBHOOK_SECRET`)
- Google-Anmeldung: neue Weiterleitungs-URI `https://<domain>/api/auth/callback/google`
- Taktgeber (cron-job.org bzw. der GitHub-Workflow): neue URL
- Resend: Absender-Domain verifiziert lassen (`RESEND_FROM_EMAIL`)

## Lokales Setup

### 1. Voraussetzungen

- [Node.js](https://nodejs.org/) **20.9 oder neuer** (Next.js 16 benötigt mindestens diese
  Version)
- [Docker](https://www.docker.com/) (für lokale Postgres-Datenbank) oder eine eigene
  Postgres-Instanz
- Ein [Stripe-Testkonto](https://dashboard.stripe.com/register) (kostenlos)

### 2. Installation

```bash
npm install
cp .env.example .env
```

Trage in `.env` ein:

- `NEXTAUTH_SECRET`: generieren mit `openssl rand -base64 32`
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: aus dem Stripe-Dashboard
  (Testmodus, "Entwickler" → "API-Schlüssel")
- `STRIPE_WEBHOOK_SECRET`: siehe Schritt 5

### 3. Datenbank starten & migrieren

```bash
docker compose up -d
npx prisma migrate dev
npm run seed
```

Der Seed legt einen Beispiel-Lehrer an (`lehrer@quran-madrasa.de` / `lehrer1234`) sowie
zwei Beispielkurse.

### 4. Stripe-Preise anlegen

Für jeden Kurs im Stripe-Dashboard ein Produkt mit **wiederkehrendem monatlichen Preis**
anlegen und die Price-ID (`price_...`) am jeweiligen Kurs in der Datenbank hinterlegen
(z.B. via `npx prisma studio`, Feld `stripePriceId`). Erst dann kann der Kurs im
Lehrer-Bereich veröffentlicht und abonniert werden.

### 5. Stripe-Webhook lokal testen

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Das ausgegebene `whsec_...` in `STRIPE_WEBHOOK_SECRET` eintragen.

### 6. Dev-Server starten

```bash
npm run dev
```

App läuft auf http://localhost:3000.

## Team-Workflow (Zusammenarbeit im GitHub-Repo)

- `main` ist immer deploybar. Für jede Aufgabe einen eigenen Branch
  (`feature/...`, `fix/...`) von `main` abzweigen.
- Änderungen per **Pull Request** nach `main` bringen, nicht direkt pushen. Die
  GitHub Action unter `.github/workflows/ci.yml` prüft bei jedem PR automatisch
  Lint, Typecheck, Build und Datenbank-Migrationen.
- Mindestens ein Review durch ein zweites Teammitglied vor dem Merge (unter
  "Settings → Branches → Branch protection rules" in GitHub aktivierbar).
- Schema-Änderungen an der Datenbank immer über `npx prisma migrate dev --name ...`
  vornehmen, damit Migrationen versioniert im Repo landen (`prisma/migrations/`) und
  jedes Teammitglied denselben Stand bekommt.

## GitHub-Organisation & Repository anlegen

`gh` (GitHub CLI) ist auf diesem Rechner nicht installiert, daher hier die Schritte
über die GitHub-Weboberfläche:

1. Auf [github.com/organizations/new](https://github.com/organizations/new) eine neue
   Organisation **"Naqshbandi Germany"** anlegen (kostenloser Plan reicht für den
   Prototyp).
2. In der Organisation über "New repository" ein Repo **"quran-madrasa"** anlegen
   (Sichtbarkeit: **Private**, solange es ein Prototyp ist), ohne README/gitignore
   (existiert bereits lokal).
3. Teammitglieder unter "Settings → People" zur Organisation bzw. unter dem Repo unter
   "Settings → Collaborators" einladen.
4. Lokal das Repo verbinden und pushen:

   ```bash
   git init
   git add .
   git commit -m "Initial scaffold: Next.js + Prisma + Stripe + Zoom-Klassenraum"
   git branch -M main
   git remote add origin https://github.com/naqshbandi-germany/quran-madrasa.git
   git push -u origin main
   ```

5. Optional: unter "Settings → Branches" eine Branch-Protection-Regel für `main`
   einrichten (Pull Request + mindestens 1 Review + CI muss grün sein, bevor gemerged
   werden kann).

## Nächste sinnvolle Schritte

- Eigenständiger Online-Klassenraum mit Tafel-Funktion (`ClassroomType.IN_APP`) als
  Ersatz/Ergänzung zu Jitsi (z.B. selbst gehostet)
- E-Mail-Versand (Registrierungsbestätigung, Erinnerung vor Unterrichtsbeginn)
- Admin-Oberfläche zur Nutzerverwaltung und Freischaltung weiterer Lehrer
- Mehrsprachigkeit (Deutsch/Arabisch/Englisch)
- Deployment (z.B. Vercel für die App + eine gehostete Postgres-Instanz, z.B. Supabase
  oder Neon)
