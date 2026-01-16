import { prisma } from "@/lib/prisma";
import { Debt } from "@prisma/client";

export class DebtPolicy {
  /**
   * Check if user can view a debt (must be lender or borrower)
   * Pass the debt object to avoid duplicate database calls
   */
  static canView(
    userId: string,
    debt: Pick<Debt, "lenderId" | "borrowerId">
  ): boolean {
    return debt.lenderId === userId || debt.borrowerId === userId;
  }

  /**
   * Check if user can update a debt (must be lender or borrower)
   * Makes DB call to verify permission before update
   */
  static async canUpdate(
    userId: string,
    debtId: number
  ): Promise<{ canUpdate: boolean; isLender: boolean; debt: Debt | null }> {
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt) {
      return { canUpdate: false, isLender: false, debt: null };
    }

    const isLender = debt.lenderId === userId;
    const isBorrower = debt.borrowerId === userId;
    const canUpdate = isLender || isBorrower;

    return { canUpdate, isLender, debt };
  }

  /**
   * Check if user can delete a debt (only lender)
   * Makes DB call to verify permission before delete
   */
  static async canDelete(userId: string, debtId: number): Promise<boolean> {
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      select: { lenderId: true },
    });

    if (!debt) return false;

    return debt.lenderId === userId;
  }
}
