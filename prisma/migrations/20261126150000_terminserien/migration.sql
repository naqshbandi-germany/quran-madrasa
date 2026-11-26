-- Terminserien und Kursstatus: Aus einer Serie entstehen Stundenplan-Eintraege und, sobald der
-- Kurs gestartet ist, die einzelnen Stunden. Bestehende Daten werden uebernommen.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SessionSeries" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "weekdays" "Weekday"[],
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "firstDate" DATE,
    "lastDate" DATE,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionSeries_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ScheduleSlot" ADD COLUMN "seriesId" TEXT;

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN "seriesId" TEXT,
ADD COLUMN "seriesDate" DATE,
ADD COLUMN "isException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cancelledAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "SessionSeries" ADD CONSTRAINT "SessionSeries_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSlot" ADD CONSTRAINT "ScheduleSlot_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "SessionSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "SessionSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 1. Stunden, die zusammen als "mehrere Termine" angelegt wurden (gleicher Kurs, gleicher
--    Anlegezeitpunkt), werden zu Serien: gleicher Titel, gleiche Ortszeit und Dauer = eine Serie,
--    auch ueber mehrere Wochentage.
CREATE TEMP TABLE tmp_sess AS
SELECT s."id", s."courseId", s."title", s."durationMin",
       (s."startsAt" AT TIME ZONE 'UTC') AT TIME ZONE COALESCE(u."timeZone", 'Europe/Berlin') AS local_ts
FROM "ClassSession" s
JOIN "Course" c ON c."id" = s."courseId"
JOIN "User" u ON u."id" = c."teacherId"
WHERE (s."courseId", s."createdAt") IN (
  SELECT "courseId", "createdAt" FROM "ClassSession" GROUP BY 1, 2 HAVING count(*) > 1
);

CREATE TEMP TABLE tmp_series AS
SELECT 'c' || md5(random()::text || g."courseId" || g."title" || g.st || g.dur::text) AS id, g.*
FROM (
  SELECT "courseId", "title", to_char(local_ts, 'HH24:MI') AS st, "durationMin" AS dur,
         array_agg(DISTINCT upper(trim(to_char(local_ts, 'Day')))) AS days,
         min(local_ts::date) AS first_date, max(local_ts::date) AS last_date
  FROM tmp_sess
  GROUP BY "courseId", "title", to_char(local_ts, 'HH24:MI'), "durationMin"
) g;

INSERT INTO "SessionSeries" ("id", "courseId", "title", "weekdays", "startTime", "endTime", "firstDate", "lastDate")
SELECT id, "courseId", "title", days::text[]::"Weekday"[], st,
       to_char(('2000-01-01 ' || st)::timestamp + dur * interval '1 minute', 'HH24:MI'),
       first_date, last_date
FROM tmp_series;

UPDATE "ClassSession" s
SET "seriesId" = t.id, "seriesDate" = ts.local_ts::date
FROM tmp_sess ts
JOIN tmp_series t
  ON t."courseId" = ts."courseId" AND t."title" = ts."title"
 AND t.st = to_char(ts.local_ts, 'HH24:MI') AND t.dur = ts."durationMin"
WHERE s."id" = ts."id";

-- 2. Stundenplan-Eintraege mit gleicher Zeit gehoeren zu einer solchen Serie.
UPDATE "ScheduleSlot" sl
SET "seriesId" = ss."id"
FROM "SessionSeries" ss
WHERE ss."courseId" = sl."courseId" AND ss."startTime" = sl."startTime" AND ss."endTime" = sl."endTime"
  AND sl."weekday" = ANY(ss."weekdays");

-- 3. Uebrige Stundenplan-Eintraege werden zu Serien ohne Datum (gleiche Zeit und gleicher
--    Hinweis = eine Serie ueber mehrere Wochentage).
CREATE TEMP TABLE tmp_slot_series AS
SELECT 'c' || md5(random()::text || g."courseId" || g."startTime" || g."endTime" || COALESCE(g."note", '')) AS id, g.*
FROM (
  SELECT "courseId", "startTime", "endTime", "note", array_agg(DISTINCT "weekday") AS days
  FROM "ScheduleSlot"
  WHERE "seriesId" IS NULL
  GROUP BY "courseId", "startTime", "endTime", "note"
) g;

INSERT INTO "SessionSeries" ("id", "courseId", "title", "weekdays", "startTime", "endTime", "note")
SELECT t.id, t."courseId", c."title", t.days, t."startTime", t."endTime", t."note"
FROM tmp_slot_series t
JOIN "Course" c ON c."id" = t."courseId";

UPDATE "ScheduleSlot" sl
SET "seriesId" = t.id
FROM tmp_slot_series t
WHERE sl."seriesId" IS NULL AND sl."courseId" = t."courseId" AND sl."startTime" = t."startTime"
  AND sl."endTime" = t."endTime" AND sl."note" IS NOT DISTINCT FROM t."note";

-- 4. Fehlende Stundenplan-Eintraege fuer Serien aus Stunden ergaenzen (ein Eintrag je Wochentag).
INSERT INTO "ScheduleSlot" ("id", "courseId", "weekday", "startTime", "endTime", "seriesId")
SELECT 'c' || md5(random()::text || ss."id" || d::text), ss."courseId", d, ss."startTime", ss."endTime", ss."id"
FROM "SessionSeries" ss
CROSS JOIN LATERAL unnest(ss."weekdays") AS d
WHERE NOT EXISTS (SELECT 1 FROM "ScheduleSlot" sl WHERE sl."seriesId" = ss."id" AND sl."weekday" = d);

-- 5. Kurse mit Stunden gelten als gestartet.
UPDATE "Course" c
SET "startedAt" = (SELECT min(s."createdAt") FROM "ClassSession" s WHERE s."courseId" = c."id")
WHERE EXISTS (SELECT 1 FROM "ClassSession" s WHERE s."courseId" = c."id");

DROP TABLE tmp_sess;
DROP TABLE tmp_series;
DROP TABLE tmp_slot_series;
