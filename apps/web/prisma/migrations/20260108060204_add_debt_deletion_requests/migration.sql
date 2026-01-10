-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedBy" TEXT;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_deletionRequestedBy_fkey" FOREIGN KEY ("deletionRequestedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
