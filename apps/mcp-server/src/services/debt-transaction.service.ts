import { prisma } from "../lib/prisma";

/**
 * Behavioral twin of apps/web/src/services/debt-transaction.service.ts
 * (email notifications omitted).
 */

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
  async createTransaction(params: CreateTransactionParams) {
    const { debtId, type, requesterId, proposedAmount, proposedDescription, reason } =
      params;

    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: { lender: true, borrower: true },
    });

    if (!debt) {
      throw new Error("Debt not found");
    }

    const isLender = debt.lenderId === requesterId;
    const isBorrower = debt.borrowerId === requesterId;

    if (!isLender && !isBorrower) {
      throw new Error(
        "You are not authorized to create a transaction for this debt",
      );
    }

    if (type === "modify") {
      if (proposedAmount === undefined && proposedDescription === undefined) {
        throw new Error(
          "Modification must include at least one change (amount or description)",
        );
      }
      if (proposedAmount !== undefined && proposedAmount <= 0) {
        throw new Error("Proposed amount must be positive");
      }
    }

    const existingPending = await prisma.debtTransaction.findFirst({
      where: {
        debtId,
        status: "pending",
      },
    });

    if (existingPending) {
      throw new Error("There is already a pending transaction for this debt");
    }

    const transaction = await prisma.debtTransaction.create({
      data: {
        debtId,
        type,
        requesterId,
        proposedAmount: type === "modify" ? proposedAmount : null,
        proposedDescription: type === "modify" ? proposedDescription : null,
        reason,
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

    const updateData: { lenderApproved?: boolean; borrowerApproved?: boolean } =
      {};
    if (isLender) {
      updateData.lenderApproved = true;
    }
    if (isBorrower) {
      updateData.borrowerApproved = true;
    }

    const willBothApprove =
      (updateData.lenderApproved || transaction.lenderApproved) &&
      (updateData.borrowerApproved || transaction.borrowerApproved);

    if (willBothApprove) {
      const result = await prisma.$transaction(async (tx) => {
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

        if (transaction.type === "drop") {
          const debtToDelete = await tx.debt.findUnique({
            where: { id: transaction.debtId },
            select: { alertId: true },
          });

          if (debtToDelete?.alertId) {
            await tx.alert.update({
              where: { id: debtToDelete.alertId },
              data: { isActive: false },
            });
          }

          await tx.debt.delete({
            where: { id: transaction.debtId },
          });
        } else if (transaction.type === "modify") {
          const debtUpdate: {
            amount?: number;
            description?: string;
          } = {};
          const nextAmount = transaction.proposedAmount;
          if (nextAmount !== null && nextAmount !== undefined) {
            debtUpdate.amount = nextAmount;
          }
          const nextDescription = transaction.proposedDescription;
          if (nextDescription !== null && nextDescription !== undefined) {
            debtUpdate.description = nextDescription;
          }
          await tx.debt.update({
            where: { id: transaction.debtId },
            data: debtUpdate,
          });
        } else if (transaction.type === "confirm_paid") {
          const updatedDebt = await tx.debt.update({
            where: { id: transaction.debtId },
            data: { status: "paid" },
            include: { alert: true },
          });

          if (updatedDebt.alertId) {
            await tx.alert.update({
              where: { id: updatedDebt.alertId },
              data: { isActive: false },
            });
          }
        }

        return updatedTransaction;
      });

      return { transaction: result, debtUpdated: true };
    }

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

  async getDebtTransactions(debtId: number, userId: string) {
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
    });

    if (!debt) {
      throw new Error("Debt not found");
    }

    if (debt.lenderId !== userId && debt.borrowerId !== userId) {
      throw new Error("You do not have access to this debt");
    }

    return prisma.debtTransaction.findMany({
      where: { debtId },
      include: {
        requester: { select: userSelect },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const debtTransactionService = new DebtTransactionService();
