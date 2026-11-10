-- Live-Test: versteckte Kurse mit geheimem Link, einmalige Anmeldegebuehr, Kalender-Abo und
-- Ueberwachung des Erinnerungs-Cron.

-- AlterTable
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "accessCode" TEXT;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "signupFeeCents" INTEGER;
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "signupFeePriceId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "calendarToken" TEXT;
ALTER TABLE "SiteContent" ADD COLUMN IF NOT EXISTS "remindersLastRunAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Course_accessCode_key" ON "Course"("accessCode");
CREATE UNIQUE INDEX IF NOT EXISTS "User_calendarToken_key" ON "User"("calendarToken");
