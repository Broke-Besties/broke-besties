-- CreateTable
CREATE TABLE "DebtTransaction" (
    "id" SERIAL NOT NULL,
    "debtId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requesterId" TEXT NOT NULL,
    "lenderApproved" BOOLEAN NOT NULL DEFAULT false,
    "borrowerApproved" BOOLEAN NOT NULL DEFAULT false,
    "proposedAmount" DOUBLE PRECISION,
    "proposedDescription" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "DebtTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DebtTransaction_debtId_idx" ON "DebtTransaction"("debtId");

-- CreateIndex
CREATE INDEX "DebtTransaction_requesterId_idx" ON "DebtTransaction"("requesterId");

-- CreateIndex
CREATE INDEX "DebtTransaction_status_idx" ON "DebtTransaction"("status");

-- AddForeignKey
ALTER TABLE "DebtTransaction" ADD CONSTRAINT "DebtTransaction_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtTransaction" ADD CONSTRAINT "DebtTransaction_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
