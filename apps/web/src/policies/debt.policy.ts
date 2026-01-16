import { prisma } from "@/lib/prisma";
import { Debt } from "@prisma/client";

export class DebtPolicy {
  /**
   * Check if user can view a debt (must be lender, borrower, or group member)
   */
  static async canView(
    userId: string,
    debt: Pick<Debt, "lenderId" | "borrowerId" | "groupId">
  ): Promise<boolean> {
    // Direct involvement - lender or borrower
    if (debt.lenderId === userId || debt.borrowerId === userId) {
      return true;
    }

    // Check group membership if debt belongs to a group
    if (debt.groupId) {
      const membership = await prisma.groupMember.findUnique({
        where: {
          userId_groupId: { userId, groupId: debt.groupId },
        },
      });

      if (membership) {
        return true;
      }
    }

    return false;
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
