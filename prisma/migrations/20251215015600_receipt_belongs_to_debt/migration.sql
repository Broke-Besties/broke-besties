/*
  Warnings:

  - You are about to drop the column `userId` on the `Receipt` table. All the data in the column will be lost.
  - Added the required column `debtId` to the `Receipt` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_userId_fkey";

-- DropIndex
DROP INDEX "Receipt_userId_idx";

-- AlterTable
ALTER TABLE "Receipt" DROP COLUMN "userId",
ADD COLUMN     "debtId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Receipt_debtId_idx" ON "Receipt"("debtId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
