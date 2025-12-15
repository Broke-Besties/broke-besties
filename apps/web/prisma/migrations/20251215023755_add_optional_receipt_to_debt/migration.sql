-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "receiptId" TEXT;

-- CreateIndex
CREATE INDEX "Debt_receiptId_idx" ON "Debt"("receiptId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
