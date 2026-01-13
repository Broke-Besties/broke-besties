-- DropForeignKey
ALTER TABLE "Debt" DROP CONSTRAINT "Debt_groupId_fkey";

-- AlterTable
ALTER TABLE "Debt" ALTER COLUMN "groupId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tab" ALTER COLUMN "status" SET DEFAULT 'borrowing';

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
