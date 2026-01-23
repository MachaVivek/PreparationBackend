-- CreateTable
CREATE TABLE "Pattern" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "howToIdentify" TEXT,
    "relations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ConceptToPattern" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ConceptToPattern_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PatternToQuestion" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PatternToQuestion_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pattern_name_key" ON "Pattern"("name");

-- CreateIndex
CREATE INDEX "_ConceptToPattern_B_index" ON "_ConceptToPattern"("B");

-- CreateIndex
CREATE INDEX "_PatternToQuestion_B_index" ON "_PatternToQuestion"("B");

-- AddForeignKey
ALTER TABLE "_ConceptToPattern" ADD CONSTRAINT "_ConceptToPattern_A_fkey" FOREIGN KEY ("A") REFERENCES "Concept"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ConceptToPattern" ADD CONSTRAINT "_ConceptToPattern_B_fkey" FOREIGN KEY ("B") REFERENCES "Pattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PatternToQuestion" ADD CONSTRAINT "_PatternToQuestion_A_fkey" FOREIGN KEY ("A") REFERENCES "Pattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PatternToQuestion" ADD CONSTRAINT "_PatternToQuestion_B_fkey" FOREIGN KEY ("B") REFERENCES "Question"("questionUrl") ON DELETE CASCADE ON UPDATE CASCADE;
