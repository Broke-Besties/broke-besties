/*
  Warnings:

  - A unique constraint covering the columns `[alertId]` on the table `Debt` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[alertId]` on the table `RecurringPayment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "alertId" INTEGER;

-- AlterTable
ALTER TABLE "RecurringPayment" ADD COLUMN     "alertId" INTEGER,
ADD COLUMN     "groupId" INTEGER;

-- AlterTable
ALTER TABLE "_DebtToReceipt" ADD CONSTRAINT "_DebtToReceipt_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_DebtToReceipt_AB_unique";

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "message" TEXT,
    "deadline" TIMESTAMP(3),
    "groupId" INTEGER,
    "lenderId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_groupId_idx" ON "Alert"("groupId");

-- CreateIndex
CREATE INDEX "Alert_lenderId_idx" ON "Alert"("lenderId");

-- CreateIndex
CREATE INDEX "Alert_borrowerId_idx" ON "Alert"("borrowerId");

-- CreateIndex
CREATE INDEX "Alert_isActive_idx" ON "Alert"("isActive");

-- CreateIndex
CREATE INDEX "Alert_deadline_idx" ON "Alert"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "Debt_alertId_key" ON "Debt"("alertId");

-- CreateIndex
CREATE INDEX "Debt_alertId_idx" ON "Debt"("alertId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringPayment_alertId_key" ON "RecurringPayment"("alertId");

-- CreateIndex
CREATE INDEX "RecurringPayment_groupId_idx" ON "RecurringPayment"("groupId");

-- CreateIndex
CREATE INDEX "RecurringPayment_alertId_idx" ON "RecurringPayment"("alertId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;
