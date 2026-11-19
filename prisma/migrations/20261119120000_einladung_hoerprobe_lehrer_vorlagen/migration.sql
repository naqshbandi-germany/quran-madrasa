-- AlterTable
ALTER TABLE "Invitation" ADD COLUMN     "sampleRequest" TEXT;

-- AlterTable
ALTER TABLE "TrialSample" ADD COLUMN     "invitationId" TEXT,
ALTER COLUMN "trialGuestId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TeacherEmailTemplate" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "buttonLabel" TEXT NOT NULL DEFAULT '',
    "footer" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherEmailTemplate_pkey" PRIMARY KEY ("userId","key")
);

-- CreateIndex
CREATE INDEX "TrialSample_invitationId_idx" ON "TrialSample"("invitationId");

-- AddForeignKey
ALTER TABLE "TrialSample" ADD CONSTRAINT "TrialSample_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "Invitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherEmailTemplate" ADD CONSTRAINT "TeacherEmailTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
