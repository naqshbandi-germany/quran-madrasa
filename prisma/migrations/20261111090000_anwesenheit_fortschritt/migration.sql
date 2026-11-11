-- Schritt 2a: Anwesenheit und Lernfortschritt pro Stunde und Teilnehmer.

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'EXCUSED', 'ABSENT');

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN "homework" TEXT,
ADD COLUMN "lessonContent" TEXT;

-- CreateTable
CREATE TABLE "SessionEvaluation" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "attendance" "AttendanceStatus",
    "surah" INTEGER,
    "ayah" INTEGER,
    "tajweedRating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionEvaluation_participantId_idx" ON "SessionEvaluation"("participantId");
CREATE UNIQUE INDEX "SessionEvaluation_sessionId_participantId_key" ON "SessionEvaluation"("sessionId", "participantId");

-- AddForeignKey
ALTER TABLE "SessionEvaluation" ADD CONSTRAINT "SessionEvaluation_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionEvaluation" ADD CONSTRAINT "SessionEvaluation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
