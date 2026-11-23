-- Neues Ereignis "Teilnehmer ausgetragen" und Nachtrag der bisher nicht erfassten Ereignisse
-- (z. B. kostenlose Anmeldungen per Einladung). Es werden keine E-Mails verschickt; nachgetragene
-- Benachrichtigungen gelten als gelesen und stehen mit dem damaligen Datum im Verlauf.

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ENROLLMENT_REMOVED';

-- Anmeldungen
INSERT INTO "ActivityEvent" ("id", "type", "courseId", "participantId", "data", "dedupeKey", "createdAt")
SELECT 'nachtrag' || md5('enrollment:' || e."id"), 'ENROLLMENT_CREATED', e."courseId", e."participantId",
  jsonb_build_object(
    'course', c."title", 'owner', u."name",
    'participants', jsonb_build_array(
      CASE WHEN COALESCE(trim(p."muslimName"), '') NOT IN ('', p."name")
        THEN trim(p."muslimName") || ' (' || p."name" || ')' ELSE p."name" END)),
  'enrollment:' || e."id", e."createdAt"
FROM "Enrollment" e
JOIN "Course" c ON c."id" = e."courseId"
JOIN "Participant" p ON p."id" = e."participantId"
JOIN "User" u ON u."id" = e."userId"
WHERE NOT EXISTS (
  SELECT 1 FROM "ActivityEvent" a
  WHERE a."type" = 'ENROLLMENT_CREATED' AND position(e."id" IN a."dedupeKey") > 0)
ON CONFLICT ("dedupeKey") DO NOTHING;

-- Hoerproben von Teilnehmern (nicht die schon als Probestunde/Einladung gemeldeten Aufnahmen,
-- die spaeter dem Teilnehmer zugeordnet wurden)
INSERT INTO "ActivityEvent" ("id", "type", "courseId", "participantId", "data", "dedupeKey", "createdAt")
SELECT 'nachtrag' || md5('reading-sample:' || s."id"), 'READING_SAMPLE_UPLOADED', s."courseId", s."participantId",
  jsonb_strip_nulls(jsonb_build_object(
    'course', c."title", 'note', s."note",
    'participants', jsonb_build_array(
      CASE WHEN COALESCE(trim(p."muslimName"), '') NOT IN ('', p."name")
        THEN trim(p."muslimName") || ' (' || p."name" || ')' ELSE p."name" END))),
  'reading-sample:' || s."id", s."createdAt"
FROM "ReadingSample" s
JOIN "Course" c ON c."id" = s."courseId"
JOIN "Participant" p ON p."id" = s."participantId"
WHERE NOT EXISTS (
  SELECT 1 FROM "ActivityEvent" a
  WHERE a."type" = 'READING_SAMPLE_UPLOADED' AND a."courseId" = s."courseId"
    AND a."dedupeKey" LIKE 'trial-sample:%'
    AND a."createdAt" BETWEEN s."createdAt" AND s."createdAt" + interval '1 minute')
ON CONFLICT ("dedupeKey") DO NOTHING;

-- Hoerproben ohne Konto (Probestunde)
INSERT INTO "ActivityEvent" ("id", "type", "courseId", "data", "dedupeKey", "createdAt")
SELECT 'nachtrag' || md5('trial-sample:' || s."id"), 'READING_SAMPLE_UPLOADED', t."courseId",
  jsonb_strip_nulls(jsonb_build_object(
    'course', c."title", 'note', s."note", 'trial', true,
    'trialStartsAt', to_char(t."startsAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'participants', jsonb_build_array(g."name"))),
  'trial-sample:' || s."id", s."createdAt"
FROM "TrialSample" s
JOIN "TrialGuest" g ON g."id" = s."trialGuestId"
JOIN "TrialLesson" t ON t."id" = g."trialLessonId"
JOIN "Course" c ON c."id" = t."courseId"
ON CONFLICT ("dedupeKey") DO NOTHING;

-- Hoerproben ohne Konto (Kurseinladung)
INSERT INTO "ActivityEvent" ("id", "type", "courseId", "data", "dedupeKey", "createdAt")
SELECT 'nachtrag' || md5('trial-sample:' || s."id"), 'READING_SAMPLE_UPLOADED', i."courseId",
  jsonb_strip_nulls(jsonb_build_object(
    'course', c."title", 'note', s."note", 'invitation', true,
    'participants', jsonb_build_array(COALESCE(NULLIF(i."name", ''), 'Eingeladene Person')))),
  'trial-sample:' || s."id", s."createdAt"
FROM "TrialSample" s
JOIN "Invitation" i ON i."id" = s."invitationId"
JOIN "Course" c ON c."id" = i."courseId"
ON CONFLICT ("dedupeKey") DO NOTHING;

-- Warteliste
INSERT INTO "ActivityEvent" ("id", "type", "courseId", "data", "dedupeKey", "createdAt")
SELECT 'nachtrag' || md5('waitlist:' || w."id"), 'WAITLIST_JOINED', w."courseId",
  jsonb_build_object('course', c."title", 'owner', w."name"), 'waitlist:' || w."id", w."createdAt"
FROM "WaitlistEntry" w
JOIN "Course" c ON c."id" = w."courseId"
ON CONFLICT ("dedupeKey") DO NOTHING;

-- Alle Kurs-Ereignisse der heutigen Lehrkraft des Kurses zeigen (auch solche, die noch an eine
-- fruehere Lehrkraft gingen). Vorhandene Benachrichtigungen bleiben unveraendert.
INSERT INTO "Notification" ("id", "eventId", "userId", "readAt", "createdAt")
SELECT 'nachtrag' || md5(a."id" || c."teacherId"), a."id", c."teacherId", CURRENT_TIMESTAMP, a."createdAt"
FROM "ActivityEvent" a
JOIN "Course" c ON c."id" = a."courseId"
WHERE a."type" <> 'PAYMENT_FAILED'
ON CONFLICT ("eventId", "userId") DO NOTHING;
