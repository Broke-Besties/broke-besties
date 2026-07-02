-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "expenseId" INTEGER;

-- CreateTable
CREATE TABLE "GroupExpense" (
    "id" SERIAL NOT NULL,
    "description" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "lenderId" TEXT NOT NULL,
    "groupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupExpense_lenderId_idx" ON "GroupExpense"("lenderId");

-- CreateIndex
CREATE INDEX "GroupExpense_groupId_idx" ON "GroupExpense"("groupId");

-- CreateIndex
CREATE INDEX "Debt_expenseId_idx" ON "Debt"("expenseId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "GroupExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupExpense" ADD CONSTRAINT "GroupExpense_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupExpense" ADD CONSTRAINT "GroupExpense_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
