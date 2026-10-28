import { prisma } from "../lib/prisma";

/**
 * Behavioral twin of apps/web/src/services/recurring-payment.service.ts
 * (delete/update omitted — MCP scope is list / create / toggle).
 */

type CreateRecurringPaymentParams = {
  amount: number;
  description?: string | null;
  frequency: number;
  lenderId: string;
  borrowers: Array<{ userId: string; splitPercentage: number }>;
};

type GetRecurringPaymentsFilters = {
  type?: "lending" | "borrowing" | null;
  status?: "active" | "inactive" | null;
};

export class RecurringPaymentService {
  async createRecurringPayment(params: CreateRecurringPaymentParams) {
    const { amount, description, frequency, lenderId, borrowers } = params;

    if (!amount || amount <= 0) {
      throw new Error("Valid amount is required");
    }

    if (!frequency || frequency < 1) {
      throw new Error("Frequency must be at least 1 day");
    }

    if (!borrowers || borrowers.length === 0) {
      throw new Error("At least one borrower is required");
    }

    const totalPercentage = borrowers.reduce(
      (sum, b) => sum + b.splitPercentage,
      0,
    );
    if (Math.abs(totalPercentage - 100) > 0.01) {
      throw new Error("Split percentages must sum to 100%");
    }

    if (borrowers.some((b) => b.splitPercentage <= 0)) {
      throw new Error("All split percentages must be positive");
    }

    for (const borrower of borrowers) {
      const user = await prisma.user.findUnique({
        where: { id: borrower.userId },
      });
      if (!user) {
        throw new Error(`Borrower with ID ${borrower.userId} not found`);
      }
    }

    const uniqueBorrowerIds = new Set(borrowers.map((b) => b.userId));
    if (uniqueBorrowerIds.size !== borrowers.length) {
      throw new Error("Cannot add the same borrower multiple times");
    }

    const recurringPayment = await prisma.$transaction(async (tx) => {
      const payment = await tx.recurringPayment.create({
        data: {
          amount,
          description: description || null,
          frequency,
          lenderId,
          status: "active",
        },
      });

      await tx.recurringPaymentBorrower.createMany({
        data: borrowers.map((b) => ({
          recurringPaymentId: payment.id,
          userId: b.userId,
          splitPercentage: b.splitPercentage,
        })),
      });

      const completePayment = await tx.recurringPayment.findUnique({
        where: { id: payment.id },
        include: {
          lender: true,
          borrowers: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!completePayment) {
        throw new Error("Failed to retrieve created recurring payment");
      }

      return completePayment;
    });

    return recurringPayment;
  }

  async getUserRecurringPayments(
    userId: string,
    filters: GetRecurringPaymentsFilters = {},
  ) {
    const { type, status } = filters;

    const where: {
      lenderId?: string;
      borrowers?: { some: { userId: string } };
      OR?: Array<Record<string, unknown>>;
      status?: string;
    } = {};

    if (type === "lending") {
      where.lenderId = userId;
    } else if (type === "borrowing") {
      where.borrowers = { some: { userId } };
    } else {
      where.OR = [
        { lenderId: userId },
        { borrowers: { some: { userId } } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const recurringPayments = await prisma.recurringPayment.findMany({
      where: where as never,
      include: {
        lender: true,
        borrowers: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return recurringPayments;
  }

  async toggleStatus(id: number, userId: string) {
    const payment = await prisma.recurringPayment.findUnique({
      where: { id },
      include: {
        lender: true,
      },
    });

    if (!payment) {
      throw new Error("Recurring payment not found");
    }

    if (payment.lenderId !== userId) {
      throw new Error(
        "You don't have permission to update this recurring payment",
      );
    }

    const newStatus = payment.status === "active" ? "inactive" : "active";

    const updatedPayment = await prisma.recurringPayment.update({
      where: { id },
      data: { status: newStatus },
      include: {
        lender: true,
        borrowers: {
          include: {
            user: true,
          },
        },
      },
    });

    return updatedPayment;
  }
}

export const recurringPaymentService = new RecurringPaymentService();
