import { prisma } from "@/lib/prisma";

type CreateTransactionParams = {
  debtId: number;
  type: "drop" | "modify" | "confirm_paid";
  requesterId: string;
  proposedAmount?: number;
  proposedDescription?: string;
  reason?: string;
};

type RespondToTransactionParams = {
  transactionId: number;
  userId: string;
  approve: boolean;
};

const userSelect = { id: true, email: true, name: true };
const debtInclude = {
  lender: { select: userSelect },
  borrower: { select: userSelect },
  group: { select: { id: true, name: true } },
};

export class DebtTransactionService {
  /**
   * Create a new debt transaction request
   */
  async createTransaction(params: CreateTransactionParams) {
    const {
      debtId,
      type,
      requesterId,
      proposedAmount,
      proposedDescription,
      reason,
    } = params;

    // Validate the debt exists and get its details
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: { lender: true, borrower: true },
    });

    if (!debt) {
      throw new Error("Debt not found");
    }

    // Validate requester is either lender or borrower
    const isLender = debt.lenderId === requesterId;
    const isBorrower = debt.borrowerId === requesterId;

    if (!isLender && !isBorrower) {
      throw new Error(
        "You are not authorized to create a transaction for this debt"
      );
    }

    // Validate type-specific requirements
    if (type === "modify") {
      if (proposedAmount === undefined && proposedDescription === undefined) {
        throw new Error(
          "Modification must include at least one change (amount or description)"
        );
      }
      if (proposedAmount !== undefined && proposedAmount <= 0) {
        throw new Error("Proposed amount must be positive");
      }
    }

    // Check for existing pending transactions on this debt
    const existingPending = await prisma.debtTransaction.findFirst({
      where: {
        debtId,
        status: "pending",
      },
    });

    if (existingPending) {
      throw new Error("There is already a pending transaction for this debt");
    }

    // Create the transaction with auto-approval for requester
    const transaction = await prisma.debtTransaction.create({
      data: {
        debtId,
        type,
        requesterId,
        proposedAmount: type === "modify" ? proposedAmount : null,
        proposedDescription: type === "modify" ? proposedDescription : null,
        reason,
        // Auto-approve for the requester
        lenderApproved: isLender,
        borrowerApproved: isBorrower,
      },
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
    });

    return transaction;
  }

  /**
   * Respond to a debt transaction (approve or reject)
   */
  async respondToTransaction(params: RespondToTransactionParams) {
    const { transactionId, userId, approve } = params;

    const transaction = await prisma.debtTransaction.findUnique({
      where: { id: transactionId },
      include: {
        debt: true,
      },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status !== "pending") {
      throw new Error("This transaction has already been processed");
    }

    const isLender = transaction.debt.lenderId === userId;
    const isBorrower = transaction.debt.borrowerId === userId;

    if (!isLender && !isBorrower) {
      throw new Error("You are not authorized to respond to this transaction");
    }

    // If rejecting, update status and return
    if (!approve) {
      const updated = await prisma.debtTransaction.update({
        where: { id: transactionId },
        data: {
          status: "rejected",
          resolvedAt: new Date(),
        },
        include: {
          debt: { include: debtInclude },
          requester: { select: userSelect },
        },
      });
      return { transaction: updated, debtUpdated: false };
    }

    // Approving: update the appropriate approval field
    const updateData: { lenderApproved?: boolean; borrowerApproved?: boolean } =
      {};
    if (isLender) {
      updateData.lenderApproved = true;
    }
    if (isBorrower) {
      updateData.borrowerApproved = true;
    }

    // Check if both will now be approved
    const willBothApprove =
      (updateData.lenderApproved || transaction.lenderApproved) &&
      (updateData.borrowerApproved || transaction.borrowerApproved);

    if (willBothApprove) {
      // Execute the transaction using a database transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update transaction status
        const updatedTransaction = await tx.debtTransaction.update({
          where: { id: transactionId },
          data: {
            ...updateData,
            status: "approved",
            resolvedAt: new Date(),
          },
          include: {
            debt: { include: debtInclude },
            requester: { select: userSelect },
          },
        });

        // Apply the change to the debt
        if (transaction.type === "drop") {
          await tx.debt.delete({
            where: { id: transaction.debtId },
          });
        } else if (transaction.type === "modify") {
          const debtUpdate: { amount?: number; description?: string | null } =
            {};
          if (transaction.proposedAmount !== null) {
            debtUpdate.amount = transaction.proposedAmount;
          }
          if (transaction.proposedDescription !== null) {
            debtUpdate.description = transaction.proposedDescription;
          }
          await tx.debt.update({
            where: { id: transaction.debtId },
            data: debtUpdate,
          });
        } else if (transaction.type === "confirm_paid") {
          // Mark the debt as paid
          await tx.debt.update({
            where: { id: transaction.debtId },
            data: { status: "paid" },
          });
        }

        return updatedTransaction;
      });

      return { transaction: result, debtUpdated: true };
    }

    // Only one party approved, just update the approval
    const updated = await prisma.debtTransaction.update({
      where: { id: transactionId },
      data: updateData,
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
    });

    return { transaction: updated, debtUpdated: false };
  }

  /**
   * Cancel a pending transaction (only requester can cancel)
   */
  async cancelTransaction(transactionId: number, userId: string) {
    const transaction = await prisma.debtTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.requesterId !== userId) {
      throw new Error("Only the requester can cancel this transaction");
    }

    if (transaction.status !== "pending") {
      throw new Error("This transaction has already been processed");
    }

    return prisma.debtTransaction.update({
      where: { id: transactionId },
      data: {
        status: "cancelled",
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Get pending transactions for a user (either as participant or requester)
   */
  async getUserPendingTransactions(userId: string) {
    return prisma.debtTransaction.findMany({
      where: {
        status: "pending",
        debt: {
          OR: [{ lenderId: userId }, { borrowerId: userId }],
        },
      },
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get transactions for a specific debt
   */
  async getDebtTransactions(debtId: number, userId: string) {
    // Verify user has access to the debt
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt) {
      throw new Error("Debt not found");
    }

    return prisma.debtTransaction.findMany({
      where: { debtId },
      include: {
        requester: { select: userSelect },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get a single transaction by ID
   */
  async getTransactionById(transactionId: number, userId: string) {
    const transaction = await prisma.debtTransaction.findUnique({
      where: { id: transactionId },
      include: {
        debt: { include: debtInclude },
        requester: { select: userSelect },
      },
    });

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    return transaction;
  }

  /**
   * Get count of pending transactions that need user's approval
   */
  async getPendingCountForUser(userId: string) {
    const transactions = await prisma.debtTransaction.findMany({
      where: {
        status: "pending",
        debt: {
          OR: [{ lenderId: userId }, { borrowerId: userId }],
        },
      },
      include: {
        debt: {
          select: { lenderId: true, borrowerId: true },
        },
      },
    });

    // Count only transactions where the user hasn't approved yet
    return transactions.filter((t) => {
      const isLender = t.debt.lenderId === userId;
      const isBorrower = t.debt.borrowerId === userId;

      if (isLender && !t.lenderApproved) return true;
      if (isBorrower && !t.borrowerApproved) return true;
      return false;
    }).length;
  }
}

export const debtTransactionService = new DebtTransactionService();
