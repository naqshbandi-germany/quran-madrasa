-- Kurseinladung kann zu einem Probestunden-Gast gehoeren (dieselbe Person, auch ohne E-Mail-Adresse).

-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN "trialGuestId" TEXT;

-- CreateIndex
CREATE INDEX "Invitation_trialGuestId_idx" ON "Invitation"("trialGuestId");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_trialGuestId_fkey" FOREIGN KEY ("trialGuestId") REFERENCES "TrialGuest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
