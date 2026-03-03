import { prisma } from "@/lib/prisma";
import { PaymentSuccessPayload } from "../types";

export async function handlePaymentSuccess(
  payload: PaymentSuccessPayload
): Promise<void> {
  const { debtId, providerType, providerReference, timestamp } = payload;

  // Idempotency guard: skip if already settled
  const debt = await prisma.debt.findUnique({ where: { id: debtId } });
  if (!debt) {
    console.warn(`[DatabaseListener] Debt ${debtId} not found, skipping`);
    return;
  }
  if (debt.status === "settled") {
    console.log(
      `[DatabaseListener] Debt ${debtId} already settled, skipping (idempotent)`
    );
    return;
  }

  await prisma.$transaction(async (tx) => {
    // Update debt to settled
    await tx.debt.update({
      where: { id: debtId },
      data: {
        status: "settled",
        settledAt: timestamp,
        settlementProvider: providerType,
        settlementReference: providerReference ?? null,
      },
    });

    // Deactivate linked alert
    if (debt.alertId) {
      await tx.alert.update({
        where: { id: debt.alertId },
        data: { isActive: false },
      });
    }

    // Cancel pending debt transactions
    await tx.debtTransaction.updateMany({
      where: { debtId, status: "pending" },
      data: { status: "cancelled", resolvedAt: new Date() },
    });
  });

  console.log(
    `[DatabaseListener] Debt ${debtId} settled via ${providerType}${
      providerReference ? ` (ref: ${providerReference})` : ""
    }`
  );
}
