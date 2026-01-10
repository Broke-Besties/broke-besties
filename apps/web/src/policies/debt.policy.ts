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
   * Check if user can create a debt in a group (must be member)
   */
  static async canCreate(userId: string, groupId: number): Promise<boolean> {
    const membership = await prisma.groupMember.findFirst({
      where: {
        userId,
        groupId,
      },
    });
    return !!membership;
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

  /**
   * Check if both users are members of the group before creating a debt
   * Makes DB call to verify membership
   */
  static async areBothGroupMembers(
    lenderId: string,
    borrowerId: string,
    groupId: number
  ): Promise<boolean> {
    const members = await prisma.groupMember.findMany({
      where: {
        groupId,
        userId: {
          in: [lenderId, borrowerId],
        },
      },
    });

    return members.length === 2;
  }

  /**
   * Check if user can request deletion of a debt
   * Must be lender or borrower, debt must be pending, and no existing deletion request
   */
  static async canRequestDeletion(userId: string, debtId: number): Promise<boolean> {
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      select: {
        lenderId: true,
        borrowerId: true,
        deletionRequestedBy: true,
        status: true
      },
    });

    if (!debt) return false;

    // Can't request deletion if already requested
    if (debt.deletionRequestedBy !== null) return false;

    // Only active debts can be deleted
    if (debt.status !== 'pending') return false;

    // Must be lender or borrower
    return debt.lenderId === userId || debt.borrowerId === userId;
  }

  /**
   * Check if user can approve deletion of a debt
   * Must be the other party (not the requester)
   */
  static async canApproveDeletion(userId: string, debtId: number): Promise<boolean> {
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      select: {
        lenderId: true,
        borrowerId: true,
        deletionRequestedBy: true
      },
    });

    if (!debt || !debt.deletionRequestedBy) return false;

    // Can't approve your own request
    if (debt.deletionRequestedBy === userId) return false;

    // Must be the other party (lender or borrower)
    return debt.lenderId === userId || debt.borrowerId === userId;
  }
}
