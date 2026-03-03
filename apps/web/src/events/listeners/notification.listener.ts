import { prisma } from "@/lib/prisma";
import { PaymentSuccessPayload } from "../types";

export async function handlePaymentSuccess(
  payload: PaymentSuccessPayload
): Promise<void> {
  const { debtId, amount, providerType } = payload;

  const debt = await prisma.debt.findUnique({
    where: { id: debtId },
    include: { lender: true, borrower: true },
  });

  if (!debt) {
    console.warn(`[NotificationListener] Debt ${debtId} not found, skipping`);
    return;
  }

  console.log(
    `[NotificationListener] Debt ${debtId} settled: $${amount} from ${debt.borrower.name} to ${debt.lender.name} via ${providerType}`
  );

  // TODO: Create a dedicated DebtSettledEmail template and send it here.
  // For now, log the settlement details. When the email template is ready:
  // await emailService.sendDebtSettledEmail({ lender: debt.lender, borrower: debt.borrower, amount, provider: providerType });
}
