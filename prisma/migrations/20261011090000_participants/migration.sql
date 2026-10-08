-- Teilnehmer: Ein Konto kann mehrere Personen (sich selbst, Kinder, andere Erwachsene) anmelden.

-- CreateEnum
CREATE TYPE "ParticipantRelation" AS ENUM ('SELF', 'CHILD', 'OTHER');

-- CreateTable
CREATE TABLE "Participant" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relation" "ParticipantRelation" NOT NULL,
    "birthYear" INTEGER,
    "email" TEXT,
    "whatsapp" TEXT,
    "whatsappConsentAt" TIMESTAMP(3),
    "consentConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Participant_ownerId_idx" ON "Participant"("ownerId");

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN "participantId" TEXT,
ADD COLUMN "subscriptionId" TEXT;

-- Bestehende Anmeldungen uebernehmen: jeder angemeldete Nutzer wird als "SELF"-Teilnehmer angelegt.
INSERT INTO "Participant" ("id", "ownerId", "name", "relation", "email", "createdAt")
SELECT 'self_' || u."id", u."id", u."name", 'SELF', u."email", CURRENT_TIMESTAMP
FROM "User" u
WHERE EXISTS (SELECT 1 FROM "Enrollment" e WHERE e."userId" = u."id");

UPDATE "Enrollment" SET "participantId" = 'self_' || "userId";

-- Bestehende Anmeldungen mit dem jeweils neuesten Abo desselben Nutzers und Kurses verknuepfen.
UPDATE "Enrollment" e
SET "subscriptionId" = (
  SELECT s."id" FROM "Subscription" s
  WHERE s."userId" = e."userId" AND s."courseId" = e."courseId"
  ORDER BY s."createdAt" DESC
  LIMIT 1
);

ALTER TABLE "Enrollment" ALTER COLUMN "participantId" SET NOT NULL;

-- DropIndex
DROP INDEX "Enrollment_userId_courseId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_participantId_courseId_key" ON "Enrollment"("participantId", "courseId");

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
