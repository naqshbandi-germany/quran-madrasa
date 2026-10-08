-- Holt die Blob-Spalten der Mediathek nach. Die Tabelle wurde in einer frueheren Fassung der
-- Migration 20261013090000_mediathek angelegt (ohne diese Spalten); die Befehle sind so
-- geschrieben, dass sie auch bei bereits vorhandenen Spalten nichts kaputt machen.

ALTER TABLE "MediaFile" ALTER COLUMN "data" DROP NOT NULL;
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "blobPathname" TEXT;
ALTER TABLE "MediaFile" ADD COLUMN IF NOT EXISTS "blobUrl" TEXT;
