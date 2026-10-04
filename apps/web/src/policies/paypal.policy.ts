import { Debt } from "@prisma/client";

export class PaypalPolicy {
  /**
   * Check if user can pay a debt with PayPal (borrower of a pending debt
   * with no pending change request)
   */
  static canPayDebt(
    userId: string,
    debt: Pick<Debt, "borrowerId" | "status">,
    hasPendingTransaction: boolean
  ): boolean {
    return (
      debt.borrowerId === userId &&
      debt.status === "pending" &&
      !hasPendingTransaction
    );
  }
}
