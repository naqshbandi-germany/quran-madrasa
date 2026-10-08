-- Lehrerfoto fuer Abdul Fattah (Datei: public/images/teachers/abdul-fattah.jpg).
-- Ueberschreibt kein bereits gepflegtes Foto.
UPDATE "User"
SET "image" = '/images/teachers/abdul-fattah.jpg'
WHERE "role" = 'TEACHER'
  AND "name" ILIKE '%Abdul Fattah%'
  AND ("image" IS NULL OR "image" = '');
