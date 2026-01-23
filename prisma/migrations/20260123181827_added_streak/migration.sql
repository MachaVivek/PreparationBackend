-- CreateTable
CREATE TABLE "StreakDay" (
    "date" TEXT NOT NULL,
    "totalMinutes" INTEGER NOT NULL DEFAULT 0,
    "streakDone" BOOLEAN NOT NULL DEFAULT false,
    "activeStart" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreakDay_pkey" PRIMARY KEY ("date")
);
