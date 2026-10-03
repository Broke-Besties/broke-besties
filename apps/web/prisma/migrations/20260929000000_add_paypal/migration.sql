-- CreateTable
CREATE TABLE "PaypalAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaypalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaypalPayment" (
    "id" TEXT NOT NULL,
    "debtId" INTEGER,
    "payerUserId" TEXT NOT NULL,
    "payeeUserId" TEXT NOT NULL,
    "payeePayerId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderId" TEXT,
    "captureId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "failureReason" TEXT,
    "platform" TEXT NOT NULL DEFAULT 'web',
    "returnScheme" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PaypalPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaypalAccount_userId_key" ON "PaypalAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaypalAccount_payerId_key" ON "PaypalAccount"("payerId");

-- CreateIndex
CREATE UNIQUE INDEX "PaypalPayment_orderId_key" ON "PaypalPayment"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PaypalPayment_captureId_key" ON "PaypalPayment"("captureId");

-- CreateIndex
CREATE INDEX "PaypalPayment_debtId_idx" ON "PaypalPayment"("debtId");

-- CreateIndex
CREATE INDEX "PaypalPayment_payerUserId_idx" ON "PaypalPayment"("payerUserId");

-- CreateIndex
CREATE INDEX "PaypalPayment_status_idx" ON "PaypalPayment"("status");

-- AddForeignKey
ALTER TABLE "PaypalAccount" ADD CONSTRAINT "PaypalAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaypalPayment" ADD CONSTRAINT "PaypalPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaypalPayment" ADD CONSTRAINT "PaypalPayment_payerUserId_fkey" FOREIGN KEY ("payerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaypalPayment" ADD CONSTRAINT "PaypalPayment_payeeUserId_fkey" FOREIGN KEY ("payeeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

