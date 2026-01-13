import { prisma } from "@/lib/prisma";

export class ReceiptPolicy {
  /**
   * Check if user can view a receipt (must be lender or borrower on any linked debt)
   * Pass the receipt object with debts to avoid duplicate database calls
   * Use this for GET operations when you already have the receipt data
   */
  static canView(
    userId: string,
    receipt: {
      debts: Array<{ lenderId: string; borrowerId: string }>;
    }
  ): boolean {
    return receipt.debts.some(
      (debt) => debt.lenderId === userId || debt.borrowerId === userId
    );
  }

  /**
   * Check if user can create/upload a receipt (must be lender or borrower on provided debts)
   * Makes DB call for CREATE operation before uploading
   */
  static async canCreate(userId: string, debtIds: number[]): Promise<boolean> {
    if (debtIds.length === 0) {
      return false;
    }

    // Check if user is lender or borrower on at least one of the provided debts
    const debts = await prisma.debt.findMany({
      where: {
        id: { in: debtIds },
        OR: [{ lenderId: userId }, { borrowerId: userId }],
      },
      select: { id: true },
    });

    // User must have access to all provided debtIds
    return debts.length === debtIds.length;
  }

  /**
   * Check if user can delete a receipt (must be lender or borrower on any linked debt)
   * Pass the receipt object to avoid duplicate database calls
   */
  static canDelete(
    userId: string,
    receipt: {
      debts: Array<{ lenderId: string; borrowerId: string }>;
    }
  ): boolean {
    return this.canView(userId, receipt);
  }
}
