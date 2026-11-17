-- AlterTable
ALTER TABLE "TrialGuest" ADD COLUMN     "sampleRequest" TEXT;

-- CreateTable
CREATE TABLE "TrialSample" (
    "id" TEXT NOT NULL,
    "trialGuestId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSec" INTEGER,
    "data" BYTEA,
    "blobPathname" TEXT,
    "note" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "listenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrialSample_trialGuestId_idx" ON "TrialSample"("trialGuestId");

-- AddForeignKey
ALTER TABLE "TrialSample" ADD CONSTRAINT "TrialSample_trialGuestId_fkey" FOREIGN KEY ("trialGuestId") REFERENCES "TrialGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

