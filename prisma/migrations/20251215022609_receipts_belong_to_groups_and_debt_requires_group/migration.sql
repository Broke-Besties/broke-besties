/*
  Warnings:

  - You are about to drop the column `debtId` on the `Receipt` table. All the data in the column will be lost.
  - Made the column `groupId` on table `Debt` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `groupId` to the `Receipt` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT "Receipt_debtId_fkey";

-- DropIndex
DROP INDEX "Receipt_debtId_idx";

-- AlterTable
ALTER TABLE "Debt" ALTER COLUMN "groupId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Receipt" DROP COLUMN "debtId",
ADD COLUMN     "groupId" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "Receipt_groupId_idx" ON "Receipt"("groupId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
