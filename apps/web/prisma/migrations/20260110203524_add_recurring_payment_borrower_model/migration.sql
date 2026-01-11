/*
  Warnings:

  - You are about to drop the `_RecurringPaymentBorrowers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_RecurringPaymentBorrowers" DROP CONSTRAINT "_RecurringPaymentBorrowers_A_fkey";

-- DropForeignKey
ALTER TABLE "_RecurringPaymentBorrowers" DROP CONSTRAINT "_RecurringPaymentBorrowers_B_fkey";

-- DropTable
DROP TABLE "_RecurringPaymentBorrowers";

-- CreateTable
CREATE TABLE "RecurringPaymentBorrower" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "recurringPaymentId" INTEGER NOT NULL,
    "splitPercentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringPaymentBorrower_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringPaymentBorrower_userId_idx" ON "RecurringPaymentBorrower"("userId");

-- CreateIndex
CREATE INDEX "RecurringPaymentBorrower_recurringPaymentId_idx" ON "RecurringPaymentBorrower"("recurringPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringPaymentBorrower_userId_recurringPaymentId_key" ON "RecurringPaymentBorrower"("userId", "recurringPaymentId");

-- AddForeignKey
ALTER TABLE "RecurringPaymentBorrower" ADD CONSTRAINT "RecurringPaymentBorrower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPaymentBorrower" ADD CONSTRAINT "RecurringPaymentBorrower_recurringPaymentId_fkey" FOREIGN KEY ("recurringPaymentId") REFERENCES "RecurringPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
