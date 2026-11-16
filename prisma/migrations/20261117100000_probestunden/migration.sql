-- CreateTable
CREATE TABLE "TrialLesson" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "classroomType" "ClassroomType" NOT NULL DEFAULT 'JITSI',
    "joinUrl" TEXT NOT NULL,
    "zoomMeetingId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceledAt" TIMESTAMP(3),
    "reminder24hSentAt" TIMESTAMP(3),
    "reminder1hSentAt" TIMESTAMP(3),

    CONSTRAINT "TrialLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrialGuest" (
    "id" TEXT NOT NULL,
    "trialLessonId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrialGuest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrialLesson_startsAt_idx" ON "TrialLesson"("startsAt");

-- CreateIndex
CREATE INDEX "TrialLesson_courseId_idx" ON "TrialLesson"("courseId");

-- CreateIndex
CREATE INDEX "TrialGuest_trialLessonId_idx" ON "TrialGuest"("trialLessonId");

-- AddForeignKey
ALTER TABLE "TrialLesson" ADD CONSTRAINT "TrialLesson_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialLesson" ADD CONSTRAINT "TrialLesson_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrialGuest" ADD CONSTRAINT "TrialGuest_trialLessonId_fkey" FOREIGN KEY ("trialLessonId") REFERENCES "TrialLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

