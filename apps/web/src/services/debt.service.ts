import { prisma } from "@/lib/prisma";
import { DebtPolicy } from "@/policies";
import { emailService } from "./email.service";

type CreateDebtParams = {
  amount: number;
  description?: string | null;
  lenderId: string;
  borrowerId: string;
  groupId: number;
};

type UpdateDebtParams = {
  amount?: number;
  description?: string;
  status?: string;
};

type GetDebtsFilters = {
  type?: "lending" | "borrowing" | null;
  groupId?: number | null;
  status?: string | null;
};

export class DebtService {
  /**
   * Create a new debt
   */
  async createDebt(params: CreateDebtParams) {
    const { amount, description, lenderId, borrowerId, groupId } = params;

    // Validation
    if (!amount || amount <= 0) {
      throw new Error("Valid amount is required");
    }

    if (!borrowerId) {
      throw new Error("Borrower ID is required");
    }

    if (!groupId) {
      throw new Error("Group ID is required");
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

    // Verify both users are members of the group (policy handles the check)
    if (
      !(await DebtPolicy.areBothGroupMembers(lenderId, borrowerId, groupId))
    ) {
      throw new Error("Both lender and borrower must be group members");
    }

    // Create the debt
    const debt = await prisma.debt.create({
      data: {
        amount,
        description: description || null,
        lenderId,
        borrowerId,
        groupId,
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

    // Send email notification to borrower
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

    return debt;
  }

  /**
   * Get all debts for a user with optional filters
   */
  async getUserDebts(userId: string, filters: GetDebtsFilters = {}) {
    const { type, groupId, status } = filters;

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

    if (groupId) {
      where.groupId = groupId;
    }

    if (status) {
      where.status = status;
    }

    const debts = await prisma.debt.findMany({
      where,
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

    // Both lender and borrower can update status
    if (status !== undefined) {
      updateData.status = status;
    }

    // Update the debt
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

  /**
   * Delete a debt (only lender can delete)
   */
  async deleteDebt(debtId: number, userId: string) {
    // Check if user can delete (policy handles the fetch)
    if (!(await DebtPolicy.canDelete(userId, debtId))) {
      throw new Error("Only the lender can delete this debt");
    }

    await prisma.debt.delete({
      where: { id: debtId },
    });
  }

  /**
   * Request deletion of a debt (either party can request)
   */
  async requestDebtDeletion(debtId: number, userId: string) {
    if (!(await DebtPolicy.canRequestDeletion(userId, debtId))) {
      throw new Error("Cannot request deletion for this debt");
    }

    const debt = await prisma.debt.update({
      where: { id: debtId },
      data: {
        deletionRequestedBy: userId,
        deletionRequestedAt: new Date(),
      },
      include: {
        lender: { select: { id: true, name: true, email: true } },
        borrower: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } },
        deletionRequester: { select: { name: true } },
      },
    });

    // Determine who to notify (the other party)
    const recipientEmail =
      debt.lender.id === userId ? debt.borrower.email : debt.lender.email;
    const recipientName =
      debt.lender.id === userId ? debt.borrower.name : debt.lender.name;

    // Send email to the other party
    const approveLink = `${process.env.NEXT_PUBLIC_APP_URL}/debts/${debt.id}`;
    await emailService.sendDebtDeletionRequest({
      to: recipientEmail,
      recipientName,
      requesterName: debt.deletionRequester!.name,
      amount: debt.amount,
      description: debt.description || "No description",
      groupName: debt.group.name,
      approveLink,
    });

    return debt;
  }

  /**
   * Approve deletion of a debt (other party approves)
   */
  async approveDebtDeletion(debtId: number, userId: string) {
    if (!(await DebtPolicy.canApproveDeletion(userId, debtId))) {
      throw new Error("Cannot approve deletion for this debt");
    }

    // Delete the debt (both parties agreed)
    await prisma.debt.delete({
      where: { id: debtId },
    });
  }

  /**
   * Cancel a deletion request (only the requester can cancel)
   */
  async cancelDebtDeletionRequest(debtId: number, userId: string) {
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      select: { deletionRequestedBy: true },
    });

    // Only the requester can cancel
    if (debt?.deletionRequestedBy !== userId) {
      throw new Error("Only the requester can cancel the deletion request");
    }

    return await prisma.debt.update({
      where: { id: debtId },
      data: {
        deletionRequestedBy: null,
        deletionRequestedAt: null,
      },
    });
  }
}

export const debtService = new DebtService();
