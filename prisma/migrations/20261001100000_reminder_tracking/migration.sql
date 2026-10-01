-- AlterTable
ALTER TABLE "ClassSession" ALTER COLUMN "classroomType" SET DEFAULT 'JITSI';
ALTER TABLE "ClassSession" ADD COLUMN     "reminder24hSentAt" TIMESTAMP(3);
ALTER TABLE "ClassSession" ADD COLUMN     "reminder1hSentAt" TIMESTAMP(3);
