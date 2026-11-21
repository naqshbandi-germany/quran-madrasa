-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "familyPricing" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "family" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "courseId" DROP NOT NULL;
