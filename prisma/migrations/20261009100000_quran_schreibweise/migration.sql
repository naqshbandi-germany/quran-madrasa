-- Einheitliche Schreibweise "Quran" in Kurstiteln, -beschreibungen und -kategorien
-- (vorher gemischt: Qur'an, Koran, Koran-Rezitation, ...). Der Text der Lehrer-Biografie
-- bleibt bewusst unveraendert.
UPDATE "Course"
SET
  "title" = replace(replace(replace(replace("title", 'Qur''an', 'Quran'), 'Koranrezitation', 'Quran-Rezitation'), 'Korans', 'Qurans'), 'Koran', 'Quran'),
  "description" = replace(replace(replace(replace("description", 'Qur''an', 'Quran'), 'Koranrezitation', 'Quran-Rezitation'), 'Korans', 'Qurans'), 'Koran', 'Quran'),
  "category" = replace(replace(replace(replace("category", 'Qur''an', 'Quran'), 'Koranrezitation', 'Quran-Rezitation'), 'Korans', 'Qurans'), 'Koran', 'Quran')
WHERE "title" LIKE '%Qur''an%' OR "title" LIKE '%Koran%'
   OR "description" LIKE '%Qur''an%' OR "description" LIKE '%Koran%'
   OR "category" LIKE '%Qur''an%' OR "category" LIKE '%Koran%';
