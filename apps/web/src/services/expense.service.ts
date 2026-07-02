import { prisma } from "@/lib/prisma";
import { debtService } from "./debt.service";
import { groupService } from "./group.service";

type CreateGroupExpenseParams = {
  groupId: number;
  lenderId: string; // the payer
  description?: string | null;
  totalAmount: number;
  // Non-payer participants and what each owes the payer.
  shares: Array<{ userId: string; amount: number }>;
};

export class ExpenseService {
  /**
   * Split one bill across group members: create a parent GroupExpense and one
   * child Debt (payer -> participant) per share. Each child is an ordinary 1:1
   * debt, so it flows through the existing debt list / settlement / notification
   * paths for free.
   */
  async createGroupExpense(params: CreateGroupExpenseParams) {
    const { groupId, lenderId, description, totalAmount, shares } = params;

    if (!totalAmount || totalAmount <= 0) {
      throw new Error("Valid total amount is required");
    }
    if (!shares || shares.length === 0) {
      throw new Error("At least one participant is required");
    }
    if (shares.some((s) => s.amount <= 0)) {
      throw new Error("All share amounts must be positive");
    }
    if (shares.some((s) => s.userId === lenderId)) {
      throw new Error("The payer cannot owe themselves a share");
    }

    // No duplicate participants
    const uniqueUserIds = new Set(shares.map((s) => s.userId));
    if (uniqueUserIds.size !== shares.length) {
      throw new Error("Cannot add the same participant multiple times");
    }

    // Shares can't sum to more than the bill (payer may keep their own share)
    const sharesTotal = shares.reduce((sum, s) => sum + s.amount, 0);
    if (sharesTotal - totalAmount > 0.01) {
      throw new Error("Participant shares cannot exceed the total amount");
    }

    // Payer and every participant must be members of the group
    if (!(await groupService.isUserMember(groupId, lenderId))) {
      throw new Error("You are not a member of this group");
    }
    for (const userId of uniqueUserIds) {
      if (!(await groupService.isUserMember(groupId, userId))) {
        throw new Error("All participants must be members of the group");
      }
    }

    const expense = await prisma.groupExpense.create({
      data: {
        groupId,
        lenderId,
        totalAmount,
        description: description || null,
      },
    });

    // ponytail: best-effort, not one atomic tx — validation is upfront and each
    // createDebt fires its own email + notification. Add a $transaction wrapper
    // if partial-failure orphans ever become a real problem.
    const debts = [];
    for (const share of shares) {
      debts.push(
        await debtService.createDebt({
          lenderId,
          borrowerId: share.userId,
          amount: share.amount,
          description: description || null,
          groupId,
          expenseId: expense.id,
        })
      );
    }

    return { expense, debts };
  }
}

export const expenseService = new ExpenseService();
