-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "alertId" INTEGER,
ALTER COLUMN "groupId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RecurringPayment" ADD COLUMN     "alertId" INTEGER,
ADD COLUMN     "groupId" INTEGER;

-- AlterTable
ALTER TABLE "Tab" ALTER COLUMN "status" SET DEFAULT 'borrowing';

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL,
    "deadline" TIMESTAMP(3),
    "groupId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Alert_groupId_idx" ON "Alert"("groupId");

-- CreateIndex
CREATE INDEX "Alert_isActive_idx" ON "Alert"("isActive");

-- CreateIndex
CREATE INDEX "Debt_alertId_idx" ON "Debt"("alertId");

-- CreateIndex
CREATE INDEX "RecurringPayment_groupId_idx" ON "RecurringPayment"("groupId");

-- CreateIndex
CREATE INDEX "RecurringPayment_alertId_idx" ON "RecurringPayment"("alertId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringPayment" ADD CONSTRAINT "RecurringPayment_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
