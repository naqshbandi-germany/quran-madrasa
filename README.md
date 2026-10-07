# Quran Madrasa (Arbeitstitel)

Online-Plattform für Koran-Unterricht (Tadschwid, Hifz) und islamische Wissenschaften:
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
- Stundenplan als Wochenraster (`/stundenplan`) mit farbigen Kurs-Blöcken, Legende und
  Fußnoten, plus PDF-Download (`/stundenplan/pdf`, erzeugt mit `pdf-lib`). Die Zeiten der
  Stundenplan-Einträge (`ScheduleSlot`) sind in Ortszeit Nordzypern (UTC+3, ganzjährig)
  gespeichert und werden für die Anzeige in deutsche Zeit umgerechnet
  (`src/lib/schedule-time.ts`) – die Verschiebung wechselt daher mit der deutschen
  Zeitumstellung zwischen 1 und 2 Stunden. Seiten mit Zeitangaben werden stündlich neu
  erzeugt (`revalidate = 3600`), damit sie nach der Zeitumstellung nicht veraltet bleiben.
  Im Lehrer-Bereich sind neue Zeiten deshalb ebenfalls in Ortszeit einzutragen.
- Kurse ohne Stripe-Preis (`stripePriceId`) zeigen statt des Anmelde-Buttons den Hinweis
  „Anmeldung auf Anfrage“, ein Preis von 0 € wird als „Preis auf Anfrage“ angezeigt
- Zwei getrennte Layouts: die öffentliche Marketing-Seite (`src/app/(site)/`, Nav + zentrierte
  Spalte) für Schüler/Besucher, und eine eigene App-Shell mit linker Sidebar
  (`src/app/(app)/`) für Lehrer- und Admin-Bereich – beide Route-Groups ändern nichts an den
  URLs, nur am Layout

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
