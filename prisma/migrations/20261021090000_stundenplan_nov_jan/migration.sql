-- Stundenplan November bis Januar (Quelle: Kalender_NovMar_BauerGauss.xlsx, Blatt NOV-JAN).
-- Die Zeiten sind Ortszeit Nordzypern (Lefke), die Website rechnet sie in deutsche Zeit um.
-- Ersetzt die Wochentermine der oeffentlichen Kurse; andere Kurse bleiben unberuehrt.

DELETE FROM "ScheduleSlot"
WHERE "courseId" IN (
    SELECT "id" FROM "Course"
    WHERE "slug" IN (
        'quran-level-1', 'quran-level-2', 'quran-level-3',
        'imam-al-ghazali-kurs', 'shamail-und-seerah',
        'islamische-seelenlehre-charakterbildung', 'einstieg-fiqh-aqidah'
    )
);

INSERT INTO "ScheduleSlot" ("id", "courseId", "weekday", "startTime", "endTime", "note")
SELECT
    'c' || substr(md5(random()::text || clock_timestamp()::text || v.slug || v.weekday), 1, 24),
    c."id",
    v.weekday::"Weekday",
    v.start_time,
    v.end_time,
    NULL
FROM (VALUES
    ('quran-level-1', 'TUESDAY', '15:00', '15:40'),
    ('quran-level-1', 'SATURDAY', '15:00', '15:40'),
    ('quran-level-1', 'SUNDAY', '15:00', '15:40'),
    ('quran-level-2', 'TUESDAY', '15:45', '16:25'),
    ('quran-level-2', 'SATURDAY', '15:45', '16:25'),
    ('quran-level-2', 'SUNDAY', '15:45', '16:25'),
    ('quran-level-3', 'TUESDAY', '19:00', '19:45'),
    ('quran-level-3', 'SATURDAY', '20:00', '20:45'),
    ('quran-level-3', 'SUNDAY', '19:00', '19:45'),
    ('imam-al-ghazali-kurs', 'MONDAY', '15:15', '16:15'),
    ('imam-al-ghazali-kurs', 'THURSDAY', '15:15', '16:15'),
    ('shamail-und-seerah', 'FRIDAY', '15:00', '16:00'),
    ('islamische-seelenlehre-charakterbildung', 'SUNDAY', '20:00', '21:00'),
    ('einstieg-fiqh-aqidah', 'WEDNESDAY', '15:15', '16:15'),
    ('einstieg-fiqh-aqidah', 'FRIDAY', '19:00', '20:00')
) AS v(slug, weekday, start_time, end_time)
JOIN "Course" c ON c."slug" = v.slug;
