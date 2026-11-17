-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "endsOn" DATE,
ADD COLUMN     "startsOn" DATE;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "whatsappAddedAt" TIMESTAMP(3);
