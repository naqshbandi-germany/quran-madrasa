-- Teilnehmerbegrenzung pro Kurs (NULL = unbegrenzt) und Warteliste fuer volle Kurse.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "maxParticipants" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedAt" TIMESTAMP(3),

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistEntry_courseId_email_key" ON "WaitlistEntry"("courseId", "email");
CREATE INDEX IF NOT EXISTS "WaitlistEntry_courseId_createdAt_idx" ON "WaitlistEntry"("courseId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WaitlistEntry_courseId_fkey') THEN
    ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_courseId_fkey"
      FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
