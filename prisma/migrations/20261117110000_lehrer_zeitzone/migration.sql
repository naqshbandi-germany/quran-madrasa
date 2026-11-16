-- AlterTable
ALTER TABLE "User" ADD COLUMN "timeZone" TEXT;

-- Bisher galten alle Kurszeiten als Ortszeit Nordzypern. Damit sich fuer bestehende Kurse nichts
-- verschiebt, bekommen Lehrkraefte mit Kursen diese Zeitzone; neue Lehrkraefte starten mit
-- deutscher Zeit. Abweichende Zeitzonen lassen sich danach im Lehrerprofil aendern.
UPDATE "User" SET "timeZone" = 'Europe/Istanbul'
WHERE "id" IN (SELECT DISTINCT "teacherId" FROM "Course");
