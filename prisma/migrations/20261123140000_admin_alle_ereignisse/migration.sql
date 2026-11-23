-- Admins sehen die Ereignisse aller Kurse. E-Mails dazu nur, wenn sie es einschalten.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "notifyAllCourses" BOOLEAN NOT NULL DEFAULT false;

-- Bisherige Ereignisse fuer alle Admins nachtragen (gelesen, ohne E-Mail, damaliges Datum)
INSERT INTO "Notification" ("id", "eventId", "userId", "readAt", "createdAt")
SELECT 'nachtrag' || md5(a."id" || u."id"), a."id", u."id", CURRENT_TIMESTAMP, a."createdAt"
FROM "ActivityEvent" a
CROSS JOIN "User" u
WHERE u."role" = 'ADMIN'
ON CONFLICT ("eventId", "userId") DO NOTHING;
