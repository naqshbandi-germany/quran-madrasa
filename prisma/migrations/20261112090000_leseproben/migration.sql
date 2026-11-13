-- Schritt 2b: Leseproben (kurze Audioaufnahmen nur fuer die Lehrkraft).

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "readingRequest" TEXT;

-- CreateTable
CREATE TABLE "ReadingSample" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sessionId" TEXT,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "durationSec" INTEGER,
    "data" BYTEA,
    "blobPathname" TEXT,
    "note" TEXT,
    "listenedAt" TIMESTAMP(3),
    "teacherComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadingSample_courseId_createdAt_idx" ON "ReadingSample"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "ReadingSample_participantId_idx" ON "ReadingSample"("participantId");

-- CreateIndex
CREATE INDEX "ReadingSample_sessionId_idx" ON "ReadingSample"("sessionId");

-- AddForeignKey
ALTER TABLE "ReadingSample" ADD CONSTRAINT "ReadingSample_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSample" ADD CONSTRAINT "ReadingSample_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingSample" ADD CONSTRAINT "ReadingSample_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

