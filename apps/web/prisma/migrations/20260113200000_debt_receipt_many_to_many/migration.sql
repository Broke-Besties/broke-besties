-- CreateTable (implicit many-to-many join table)
CREATE TABLE "_DebtToReceipt" (
    "A" INTEGER NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_DebtToReceipt_A_fkey" FOREIGN KEY ("A") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_DebtToReceipt_B_fkey" FOREIGN KEY ("B") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Migrate existing data from Debt.receiptId to the join table
INSERT INTO "_DebtToReceipt" ("A", "B")
SELECT "id", "receiptId" FROM "Debt" WHERE "receiptId" IS NOT NULL;

-- DropIndex
DROP INDEX IF EXISTS "Debt_receiptId_idx";

-- DropForeignKey
ALTER TABLE "Debt" DROP CONSTRAINT IF EXISTS "Debt_receiptId_fkey";

-- AlterTable - Remove receiptId from Debt
ALTER TABLE "Debt" DROP COLUMN IF EXISTS "receiptId";

-- DropIndex
DROP INDEX IF EXISTS "Receipt_groupId_idx";

-- DropForeignKey
ALTER TABLE "Receipt" DROP CONSTRAINT IF EXISTS "Receipt_groupId_fkey";

-- AlterTable - Remove groupId from Receipt
ALTER TABLE "Receipt" DROP COLUMN IF EXISTS "groupId";

-- CreateIndex
CREATE UNIQUE INDEX "_DebtToReceipt_AB_unique" ON "_DebtToReceipt"("A", "B");

-- CreateIndex
CREATE INDEX "_DebtToReceipt_B_index" ON "_DebtToReceipt"("B");
