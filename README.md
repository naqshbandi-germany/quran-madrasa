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
