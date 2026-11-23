import { prisma } from "../lib/prisma";

/**
 * Behavioral twin of apps/web/src/services/debt.service.ts (receipts and
 * email notifications omitted — a standalone MCP server has no web session;
 * parity is enforced by tests mirroring the web service tests).
 */

type CreateDebtParams = {
  amount: number;
  description?: string | null;
  lenderId: string;
  borrowerId: string;
  groupId?: number | null;
};

type UpdateDebtParams = {
  amount?: number;
  description?: string;
  status?: string;
};

type GetDebtsFilters = {
  type?: "lending" | "borrowing" | null;
  status?: string | null;
};

export class DebtService {
  async createDebt(params: CreateDebtParams) {
    const { amount, description, lenderId, borrowerId, groupId } = params;

    if (!amount || amount <= 0) {
      throw new Error("Valid amount is required");
    }

    if (!borrowerId) {
      throw new Error("Borrower ID is required");
    }

    if (borrowerId === lenderId) {
      throw new Error("Cannot create a debt to yourself");
    }

    const borrower = await prisma.user.findUnique({
      where: { id: borrowerId },
    });

    if (!borrower) {
      throw new Error("Borrower not found");
    }

    const debt = await prisma.debt.create({
      data: {
        amount,
        description: description || null,
        lenderId,
        borrowerId,
        groupId: groupId || null,
        status: "pending",
      },
      include: {
        lender: {
          select: { id: true, name: true, email: true },
        },
        borrower: {
          select: { id: true, name: true, email: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    return debt;
  }

  async getUserDebts(userId: string, filters: GetDebtsFilters = {}) {
    const { type, status } = filters;

    const where: {
      OR?: Array<Record<string, string>>;
      status?: string;
    } = {
      OR: [{ lenderId: userId }, { borrowerId: userId }],
    };

    if (type === "lending") {
      where.OR = [{ lenderId: userId }];
    } else if (type === "borrowing") {
      where.OR = [{ borrowerId: userId }];
    }

    if (status) {
      where.status = status;
    }

    const debts = await prisma.debt.findMany({
      where: where as never,
      include: {
        lender: {
          select: { id: true, email: true, name: true },
        },
        borrower: {
          select: { id: true, email: true, name: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return debts;
  }

  async getDebtById(debtId: number, userId: string) {
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: {
        lender: {
          select: { id: true, email: true, name: true },
        },
        borrower: {
          select: { id: true, email: true, name: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    if (!debt) {
      throw new Error("Debt not found");
    }

    if (debt.lenderId !== userId && debt.borrowerId !== userId) {
      throw new Error("You don't have permission to view this debt");
    }

    return debt;
  }

  async updateDebt(debtId: number, userId: string, updates: UpdateDebtParams) {
    const { amount, description, status } = updates;

    const existingDebt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!existingDebt) {
      throw new Error("Debt not found");
    }

    const isLender = existingDebt.lenderId === userId;
    const isBorrower = existingDebt.borrowerId === userId;

    if (!isLender && !isBorrower) {
      throw new Error("You don't have permission to update this debt");
    }

    const updateData: {
      amount?: number;
      description?: string;
      status?: string;
    } = {};

    if (amount !== undefined || description !== undefined) {
      if (!isLender) {
        throw new Error("Only the lender can update amount and description");
      }
      if (amount !== undefined) {
        if (amount <= 0) {
          throw new Error("Amount must be positive");
        }
        updateData.amount = amount;
      }
      if (description !== undefined) {
        updateData.description = description;
      }
    }

    if (status !== undefined) {
      updateData.status = status;
    }

    const debt = await prisma.debt.update({
      where: { id: debtId },
      data: updateData,
      include: {
        lender: {
          select: { id: true, email: true },
        },
        borrower: {
          select: { id: true, email: true },
        },
        group: {
          select: { id: true, name: true },
        },
      },
    });

    return debt;
  }
}

export const debtService = new DebtService();
