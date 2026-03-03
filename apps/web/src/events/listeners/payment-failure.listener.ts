import { prisma } from "@/lib/prisma";
import { PaymentFailedPayload } from "../types";

export async function handlePaymentFailed(
  payload: PaymentFailedPayload
): Promise<void> {
  const { debtId, reason } = payload;

  const debt = await prisma.debt.findUnique({
    where: { id: debtId },
    include: { lender: true, borrower: true },
  });

  if (!debt) {
    console.warn(`[PaymentFailureListener] Debt ${debtId} not found, skipping`);
    return;
  }

  // Log failure
  console.error(
    `[PaymentFailureListener] Payment failed for debt ${debtId}: ${reason}`
  );

  // TODO: Send notification to borrower about payment failure
  // When email service is integrated:
  // await emailService.sendPaymentFailedEmail(debt.borrower.email, {
  //   debtId,
  //   amount: debt.amount,
  //   reason,
  //   lenderName: debt.lender.name,
  // });
}
