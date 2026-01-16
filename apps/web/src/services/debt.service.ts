import { prisma } from "@/lib/prisma";
import { DebtPolicy } from "@/policies";
import { emailService } from "./email.service";

type CreateDebtParams = {
  amount: number;
  description?: string | null;
  lenderId: string;
  borrowerId: string;
  groupId?: number | null;
  receiptIds?: string[];
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
  /**
   * Create a new debt
   */
  async createDebt(params: CreateDebtParams) {
    const { amount, description, lenderId, borrowerId, groupId, receiptIds } =
      params;

    // Validation
    if (!amount || amount <= 0) {
      throw new Error("Valid amount is required");
    }

    if (!borrowerId) {
      throw new Error("Borrower ID is required");
    }

    // Prevent creating a debt to yourself
    if (borrowerId === lenderId) {
      throw new Error("Cannot create a debt to yourself");
    }

    // Verify borrower exists
    const borrower = await prisma.user.findUnique({
      where: { id: borrowerId },
    });

    if (!borrower) {
      throw new Error("Borrower not found");
    }

    // If receiptIds are provided, verify they exist
    if (receiptIds && receiptIds.length > 0) {
      const existingReceipts = await prisma.receipt.findMany({
        where: { id: { in: receiptIds } },
        select: { id: true },
      });
      if (existingReceipts.length !== receiptIds.length) {
        throw new Error("One or more receipts not found");
      }
    }

    // Create the debt with optional receipt connections
    const debt = await prisma.debt.create({
      data: {
        amount,
        description: description || null,
        lenderId,
        borrowerId,
        groupId: groupId || null,
        status: "pending",
        receipts:
          receiptIds && receiptIds.length > 0
            ? { connect: receiptIds.map((id) => ({ id })) }
            : undefined,
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
        receipts: true,
      },
    });

    // Send email notification to borrower (only if in a group)
    if (debt.group) {
      const debtLink = `${process.env.NEXT_PUBLIC_APP_URL}/debts/${debt.id}`;
      await emailService.sendDebtCreated({
        to: debt.borrower.email,
        borrowerName: debt.borrower.name,
        lenderName: debt.lender.name,
        amount: debt.amount,
        description: debt.description || "No description provided",
        groupName: debt.group.name,
        debtLink,
      });
    }

    return debt;
  }

  /**
   * Get all debts for a user with optional filters
   */
  async getUserDebts(userId: string, filters: GetDebtsFilters = {}) {
    const { type, status } = filters;

    // Build the where clause
    const where: any = {
      OR: [{ lenderId: userId }, { borrowerId: userId }],
    };

    // Apply filters
    if (type === "lending") {
      where.OR = [{ lenderId: userId }];
    } else if (type === "borrowing") {
      where.OR = [{ borrowerId: userId }];
    }

    if (status) {
      where.status = status;
    }

    const debts = await prisma.debt.findMany({
      where,
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
        receipts: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return debts;
  }

  /**
   * Get all debts for a group (user must be a member)
   */
  async getGroupDebts(groupId: number, userId: string) {
    // Verify user is a member of the group
    const membership = await prisma.groupMember.findUnique({
      where: {
        userId_groupId: { userId, groupId },
      },
    });

    if (!membership) {
      throw new Error("You must be a member of the group to view its debts");
    }

    const debts = await prisma.debt.findMany({
      where: { groupId },
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
        receipts: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return debts;
  }

  /**
   * Get a specific debt by ID
   */
  async getDebtById(debtId: number, userId: string) {
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
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
        receipts: true,
        alert: true,
      },
    });

    if (!debt) {
      throw new Error("Debt not found");
    }

    // Check permission using the fetched debt object
    if (!DebtPolicy.canView(userId, debt)) {
      throw new Error("You don't have permission to view this debt");
    }

    return debt;
  }

  /**
   * Update a debt
   */
  async updateDebt(debtId: number, userId: string, updates: UpdateDebtParams) {
    const { amount, description, status } = updates;

    // Check permission and get debt info (policy handles the fetch)
    const {
      canUpdate,
      isLender,
      debt: existingDebt,
    } = await DebtPolicy.canUpdate(userId, debtId);

    if (!canUpdate || !existingDebt) {
      throw new Error("You don't have permission to update this debt");
    }

    // Build update data
    const updateData: any = {};

    // Only lender can update amount and description
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
        receipts: true,
      },
    });

    return debt;
  }

  /**
   * Delete a debt (only lender can delete)
   */
  async deleteDebt(debtId: number, userId: string) {
    // Check if user can delete (policy handles the fetch)
    if (!(await DebtPolicy.canDelete(userId, debtId))) {
      throw new Error("Only the lender can delete this debt");
    }

    // Use transaction to deactivate alert and delete debt
    await prisma.$transaction(async (tx) => {
      // Get debt with alert
      const debt = await tx.debt.findUnique({
        where: { id: debtId },
        select: { alertId: true },
      });

      // Deactivate associated alert if it exists
      if (debt?.alertId) {
        await tx.alert.update({
          where: { id: debt.alertId },
          data: { isActive: false },
        });
      }

      // Delete the debt
      await tx.debt.delete({
        where: { id: debtId },
      });
    });
  }
}

export const debtService = new DebtService();
