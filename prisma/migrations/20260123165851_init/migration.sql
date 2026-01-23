-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "TestOutcome" AS ENUM ('SOLVED_IN_TIME', 'SOLVED_AFTER_TIME', 'NOT_SOLVED');

-- CreateTable
CREATE TABLE "Question" (
    "questionUrl" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "pattern" TEXT,
    "notes" TEXT,
    "learning" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("questionUrl")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concept" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Test" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "totalTimeMin" INTEGER NOT NULL,
    "easyCount" INTEGER NOT NULL,
    "mediumCount" INTEGER NOT NULL,
    "hardCount" INTEGER NOT NULL,
    "companies" TEXT[],
    "concepts" TEXT[],
    "submitted" BOOLEAN NOT NULL DEFAULT false,
    "completionTimeMin" INTEGER,
    "solvedCount" INTEGER,
    "outcome" "TestOutcome",
    "overallLearning" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "Test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestQuestion" (
    "id" SERIAL NOT NULL,
    "testId" INTEGER NOT NULL,
    "questionUrl" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "solved" BOOLEAN,
    "timeTakenMin" INTEGER,
    "solution" TEXT,
    "learning" TEXT,
    "mainPoints" TEXT,

    CONSTRAINT "TestQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CompanyToQuestion" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CompanyToQuestion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ConceptToQuestion" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ConceptToQuestion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_name_key" ON "Company"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Concept_name_key" ON "Concept"("name");

-- CreateIndex
CREATE INDEX "_CompanyToQuestion_B_index" ON "_CompanyToQuestion"("B");

-- CreateIndex
CREATE INDEX "_ConceptToQuestion_B_index" ON "_ConceptToQuestion"("B");

-- AddForeignKey
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestQuestion" ADD CONSTRAINT "TestQuestion_questionUrl_fkey" FOREIGN KEY ("questionUrl") REFERENCES "Question"("questionUrl") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToQuestion" ADD CONSTRAINT "_CompanyToQuestion_A_fkey" FOREIGN KEY ("A") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompanyToQuestion" ADD CONSTRAINT "_CompanyToQuestion_B_fkey" FOREIGN KEY ("B") REFERENCES "Question"("questionUrl") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConceptToQuestion" ADD CONSTRAINT "_ConceptToQuestion_A_fkey" FOREIGN KEY ("A") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConceptToQuestion" ADD CONSTRAINT "_ConceptToQuestion_B_fkey" FOREIGN KEY ("B") REFERENCES "Question"("questionUrl") ON DELETE CASCADE ON UPDATE CASCADE;
