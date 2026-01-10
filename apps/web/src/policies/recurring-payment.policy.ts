import { prisma } from "@/lib/prisma";

export class RecurringPaymentPolicy {
  /**
   * Check if user can view a recurring payment (must be lender or borrower)
   */
  static async canView(userId: string, paymentId: number): Promise<boolean> {
    const payment = await prisma.recurringPayment.findUnique({
      where: { id: paymentId },
      select: {
        lenderId: true,
        borrowers: {
          select: { userId: true },
        },
      },
    });

    if (!payment) return false;

    // User can view if they're the lender or one of the borrowers
    const isBorrower = payment.borrowers.some(b => b.userId === userId);
    return payment.lenderId === userId || isBorrower;
  }

  /**
   * Check if user can update a recurring payment (only lender)
   */
  static async canUpdate(userId: string, paymentId: number): Promise<boolean> {
    const payment = await prisma.recurringPayment.findUnique({
      where: { id: paymentId },
      select: { lenderId: true },
    });

    if (!payment) return false;

    return payment.lenderId === userId;
  }

  /**
   * Check if user can delete a recurring payment (only lender)
   */
  static async canDelete(userId: string, paymentId: number): Promise<boolean> {
    const payment = await prisma.recurringPayment.findUnique({
      where: { id: paymentId },
      select: { lenderId: true },
    });

    if (!payment) return false;

    return payment.lenderId === userId;
  }
}
