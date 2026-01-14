import { prisma } from "@/lib/prisma";
import { AlertPolicy } from "@/policies";

type CreateAlertForDebtParams = {
  debtId: number;
  message?: string | null;
  deadline?: Date | null;
  userId: string;
};

type CreateAlertForRecurringPaymentParams = {
  recurringPaymentId: number;
  message?: string | null;
  userId: string;
};

type UpdateAlertParams = {
  message?: string | null;
  deadline?: Date | null;
  isActive?: boolean;
};

export class AlertService {
  /**
   * Create an alert for a debt
   */
  async createAlertForDebt(params: CreateAlertForDebtParams) {
    const { debtId, message, deadline, userId } = params;

    // Get the debt to verify ownership and get borrower info
    const debt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: { alert: true },
    });

    if (!debt) {
      throw new Error("Debt not found");
    }

    // Only lender can create alerts
    if (debt.lenderId !== userId) {
      throw new Error("Only the lender can create alerts for this debt");
    }

    // Check if debt already has an alert
    if (debt.alertId) {
      throw new Error("This debt already has an alert");
    }

    // Create alert and link to debt in a transaction
    const alert = await prisma.$transaction(async (tx) => {
      const newAlert = await tx.alert.create({
        data: {
          message: message || null,
          deadline: deadline || null,
          lenderId: debt.lenderId,
          borrowerId: debt.borrowerId,
          groupId: debt.groupId,
          isActive: true,
        },
      });

      // Link alert to debt
      await tx.debt.update({
        where: { id: debtId },
        data: { alertId: newAlert.id },
      });

      return newAlert;
    });

    return alert;
  }

  /**
   * Create an alert for a recurring payment (no deadline)
   */
  async createAlertForRecurringPayment(params: CreateAlertForRecurringPaymentParams) {
    const { recurringPaymentId, message, userId } = params;

    // Get the recurring payment to verify ownership
    const payment = await prisma.recurringPayment.findUnique({
      where: { id: recurringPaymentId },
      include: {
        alert: true,
        borrowers: true,
      },
    });

    if (!payment) {
      throw new Error("Recurring payment not found");
    }

    // Only lender can create alerts
    if (payment.lenderId !== userId) {
      throw new Error("Only the lender can create alerts for this recurring payment");
    }

    // Check if payment already has an alert
    if (payment.alertId) {
      throw new Error("This recurring payment already has an alert");
    }

    // For recurring payments, use the first borrower as the alert borrower
    // (alerts are per-payment, not per-borrower)
    const firstBorrower = payment.borrowers[0];
    if (!firstBorrower) {
      throw new Error("Recurring payment must have at least one borrower");
    }

    // Create alert and link to recurring payment in a transaction
    const alert = await prisma.$transaction(async (tx) => {
      const newAlert = await tx.alert.create({
        data: {
          message: message || null,
          deadline: null, // No deadline for recurring payments
          lenderId: payment.lenderId,
          borrowerId: firstBorrower.userId,
          groupId: payment.groupId,
          isActive: true,
        },
      });

      // Link alert to recurring payment
      await tx.recurringPayment.update({
        where: { id: recurringPaymentId },
        data: { alertId: newAlert.id },
      });

      return newAlert;
    });

    return alert;
  }

  /**
   * Get alert by ID
   */
  async getAlertById(alertId: number, userId: string) {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        lender: { select: { id: true, email: true, name: true } },
        borrower: { select: { id: true, email: true, name: true } },
      },
    });

    if (!alert) {
      throw new Error("Alert not found");
    }

    if (!AlertPolicy.canView(userId, alert)) {
      throw new Error("You don't have permission to view this alert");
    }

    return alert;
  }

  /**
   * Update an alert (only lender can update)
   */
  async updateAlert(alertId: number, userId: string, updates: UpdateAlertParams) {
    const { canUpdate, alert: existingAlert } = await AlertPolicy.canUpdate(userId, alertId);

    if (!canUpdate || !existingAlert) {
      throw new Error("You don't have permission to update this alert");
    }

    const updateData: any = {};

    if (updates.message !== undefined) {
      updateData.message = updates.message;
    }

    if (updates.deadline !== undefined) {
      updateData.deadline = updates.deadline;
    }

    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive;
    }

    const alert = await prisma.alert.update({
      where: { id: alertId },
      data: updateData,
      include: {
        lender: { select: { id: true, email: true, name: true } },
        borrower: { select: { id: true, email: true, name: true } },
      },
    });

    return alert;
  }

  /**
   * Delete an alert (only lender can delete)
   */
  async deleteAlert(alertId: number, userId: string) {
    if (!(await AlertPolicy.canDelete(userId, alertId))) {
      throw new Error("Only the lender can delete this alert");
    }

    // First, unlink from debt or recurring payment
    await prisma.$transaction(async (tx) => {
      // Check if linked to a debt
      const debt = await tx.debt.findFirst({
        where: { alertId },
      });

      if (debt) {
        await tx.debt.update({
          where: { id: debt.id },
          data: { alertId: null },
        });
      }

      // Check if linked to a recurring payment
      const recurringPayment = await tx.recurringPayment.findFirst({
        where: { alertId },
      });

      if (recurringPayment) {
        await tx.recurringPayment.update({
          where: { id: recurringPayment.id },
          data: { alertId: null },
        });
      }

      // Delete the alert
      await tx.alert.delete({
        where: { id: alertId },
      });
    });
  }
}

export const alertService = new AlertService();
