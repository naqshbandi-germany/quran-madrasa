-- Reine Daten-Migration (keine Schema-Aenderung): Lehrer-Biografie und neuer
-- Stundenplan. Alle Statements sind so geschrieben, dass sie ohne die betroffenen
-- Datensaetze (z.B. auf einer frischen lokalen Datenbank) einfach nichts tun.

-- Biografie von Abdul Fattah (Lehrer-Profil auf der Seite "Lehrer")
UPDATE "User"
SET "bio" = $bio$As-Salāmu ʿalaykum wa-Raḥmatullāhi wa-Barakātuh,

mein Name ist Abdel Fattah Bauer-Gauss. Die vergangenen acht Jahre meines Lebens habe ich dem tiefgehenden Studium der Weltreligionen, der Philosophie und der Islamwissenschaften gewidmet. Von 2017 bis 2021 absolvierte ich an der Universität Leiden einen Master of Arts in „Philosophy: Global and Comparative Perspectives“. Anschließend studierte ich von 2022 bis 2026 Islamwissenschaften und Humanwissenschaften am Zaytuna College in Berkeley, Kalifornien.

Derzeit setze ich mein Privatstudium der traditionellen islamischen Wissenschaften an der Madrasah Haqqaniyyah in Lefke, Nordzypern, fort. Dort lerne ich von unseren aus Syrien stammenden Lehrern nach dem Curriculum des Dars-i Niẓāmī.

Mit dem Segen von Mawlānā Shaykh Muḥammad ʿĀdil und der Ermutigung meiner Lehrer am Zaytuna College beginne ich nun damit unser Wissen weiterzugeben – insbesondere im Bereich des Klassischen Arabisch sowie der Einführung in die Islamwissenschaften.

Mein Anliegen ist es Muslimen zu dienen, ihre Verbindung zu unserer unschätzbar reichen Tradition zu stärken und eine engere Beziehung zum Heiligen Koran aufzubauen. Besonders am Herzen liegt mir die Vermittlung des essenziellen religiösen Wissens (farḍ ʿayn) an unsere Youngsters sowie die Stärkung der Liebe zu unserem heiligen Propheten ﷺ und zu den schimmernden Gelehrten unserer Tradition.

Gleichzeitig möchte ich all jenen, die daran Interesse haben, die traditionelle islamische Weltanschauung näherbringen. Gerade in einer Zeit großer Verwirrung erachte ich es als wichtig, die Grundlagen unserer Weltansicht verständlich zu vermitteln und dabei zu helfen, manche der Verwirrungen aufzuklären, denen wir in der modernen westlichen Welt begegnen.

In diesem Rahmen biete ich wöchentliche Kurse in verschiedenen Bereichen an, darunter Koranrezitation und Tadschwīd, Fiqh und ʿAqīdah, Sīrah und Shamāʾil sowie islamische Ethik und Charakterbildung (ʿIlm al-Akhlāq).

Mit Duʿās und Friedenswünschen,
Abdel Fattah Bauer-Gauss$bio$
WHERE "role" = 'TEACHER' AND "name" = 'Abdul Fattah';

-- Neuer Kurs "Einstieg Fiqh & Aqidah" (Beschreibung ist ein Platzhalter). Ohne
-- Stripe-Preis: die Kursseite zeigt dann "Anmeldung auf Anfrage".
INSERT INTO "Course" (
    "id", "slug", "title", "description", "category", "level", "ageGroups",
    "priceCents", "currency", "stripePriceId", "isPublished", "teacherId"
)
SELECT
    'c' || substr(md5(random()::text || clock_timestamp()::text), 1, 24),
    'einstieg-fiqh-aqidah',
    'Einstieg Fiqh & Aqidah',
    'Einführung in die Grundlagen des islamischen Glaubens (ʿAqīdah) und der islamischen Rechtspraxis (Fiqh) – verständlich erklärt und alltagsnah.',
    'Fiqh & Aqidah',
    NULL,
    ARRAY[]::"AgeGroup"[],
    0,
    'eur',
    NULL,
    true,
    u."id"
FROM "User" u
WHERE u."role" = 'TEACHER' AND u."name" = 'Abdul Fattah'
ORDER BY u."createdAt"
LIMIT 1
ON CONFLICT ("slug") DO NOTHING;

-- Neuer Stundenplan. Zeiten in Ortszeit Nordzypern (UTC+3); die Website rechnet
-- sie fuer die Anzeige in deutsche Zeit um. Ersetzt die bisherigen Zeiten dieser
-- Kurse komplett.
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
    ('quran-level-1', 'TUESDAY', '16:00', '16:45'),
    ('quran-level-1', 'SATURDAY', '15:00', '15:45'),
    ('quran-level-1', 'SUNDAY', '15:00', '15:45'),
    ('quran-level-2', 'TUESDAY', '16:50', '17:35'),
    ('quran-level-2', 'SATURDAY', '15:50', '16:35'),
    ('quran-level-2', 'SUNDAY', '15:50', '16:35'),
    ('quran-level-3', 'TUESDAY', '17:45', '18:30'),
    ('quran-level-3', 'SATURDAY', '18:15', '19:00'),
    ('quran-level-3', 'SUNDAY', '16:45', '17:30'),
    ('imam-al-ghazali-kurs', 'MONDAY', '15:30', '16:30'),
    ('imam-al-ghazali-kurs', 'THURSDAY', '15:30', '16:30'),
    ('shamail-und-seerah', 'FRIDAY', '16:45', '17:45'),
    ('islamische-seelenlehre-charakterbildung', 'SUNDAY', '17:40', '18:40'),
    ('einstieg-fiqh-aqidah', 'WEDNESDAY', '15:30', '16:30'),
    ('einstieg-fiqh-aqidah', 'FRIDAY', '15:30', '16:30')
) AS v(slug, weekday, start_time, end_time)
JOIN "Course" c ON c."slug" = v.slug;
