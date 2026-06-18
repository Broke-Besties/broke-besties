import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AlertPolicy } from "@/policies";

type CreateAlertForDebtParams = {
  debtId: number;
  message?: string | null;
  deadline?: Date | null;
  reminderFrequencyDays?: number | null;
  userId: string;
};

type CreateAlertForRecurringPaymentParams = {
  recurringPaymentId: number;
  message?: string | null;
  reminderFrequencyDays?: number | null;
  userId: string;
};

type UpdateAlertParams = {
  message?: string | null;
  deadline?: Date | null;
  isActive?: boolean;
  reminderFrequencyDays?: number | null;
};

export class AlertService {
  /**
   * Create an alert for a debt
   */
  async createAlertForDebt(params: CreateAlertForDebtParams) {
    const { debtId, message, deadline, reminderFrequencyDays, userId } = params;

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
          reminderFrequencyDays: reminderFrequencyDays ?? null,
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
    const { recurringPaymentId, message, reminderFrequencyDays, userId } = params;

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
          reminderFrequencyDays: reminderFrequencyDays ?? null,
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

    const updateData: Prisma.AlertUpdateInput = {};

    if (updates.message !== undefined) {
      updateData.message = updates.message;
    }

    if (updates.deadline !== undefined) {
      updateData.deadline = updates.deadline;
    }

    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive;
    }

    if (updates.reminderFrequencyDays !== undefined) {
      updateData.reminderFrequencyDays = updates.reminderFrequencyDays;
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
   * Allow the borrower of an alert to opt out of email reminders.
   * Sets reminderFrequencyDays to null without requiring lender permission.
   */
  async optOutOfReminders(alertId: number, userId: string) {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      select: { id: true, borrowerId: true },
    });

    if (!alert) {
      throw new Error("Alert not found");
    }

    if (alert.borrowerId !== userId) {
      throw new Error("Only the borrower can opt out of reminders for this alert");
    }

    return prisma.alert.update({
      where: { id: alertId },
      data: { reminderFrequencyDays: null },
    });
  }

  /**
   * Get all active alerts where user is the borrower
   */
  async getActiveAlertsForBorrower(userId: string) {
    const alerts = await prisma.alert.findMany({
      where: {
        borrowerId: userId,
        isActive: true,
      },
      include: {
        lender: { select: { id: true, email: true, name: true } },
        borrower: { select: { id: true, email: true, name: true } },
        debt: {
          select: {
            id: true,
            amount: true,
            description: true,
            status: true,
          },
        },
        recurringPayment: {
          select: {
            id: true,
            amount: true,
            description: true,
            status: true,
          },
        },
        group: { select: { id: true, name: true } },
      },
      orderBy: [
        { deadline: "asc" },
        { createdAt: "desc" },
      ],
    });

    return alerts;
  }

  /**
   * Get all active alerts where user is the lender (for the manage page)
   */
  async getActiveAlertsForLender(userId: string) {
    return prisma.alert.findMany({
      where: {
        lenderId: userId,
        isActive: true,
      },
      include: {
        lender: { select: { id: true, email: true, name: true } },
        borrower: { select: { id: true, email: true, name: true } },
        debt: {
          select: { id: true, amount: true, description: true, status: true },
        },
        recurringPayment: {
          select: { id: true, amount: true, description: true, status: true },
        },
        group: { select: { id: true, name: true } },
      },
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    });
  }

  /**
   * Find alerts that are due for an email reminder.
   * Sends when daysSinceCreation > 0, daysSinceCreation % reminderFrequencyDays === 0,
   * and a reminder hasn't already been sent in the last `reminderFrequencyDays` days.
   */
  async getAlertsDueForReminder(now: Date) {
    const candidates = await prisma.alert.findMany({
      where: {
        isActive: true,
        reminderFrequencyDays: { not: null },
      },
      include: {
        lender: { select: { id: true, email: true, name: true } },
        borrower: { select: { id: true, email: true, name: true } },
        debt: {
          select: { id: true, amount: true, description: true, status: true },
        },
        recurringPayment: {
          select: { id: true, amount: true, description: true, status: true },
        },
        group: { select: { id: true, name: true } },
      },
    });

    const DAY_MS = 24 * 60 * 60 * 1000;

    return candidates.filter((alert) => {
      const freq = alert.reminderFrequencyDays;
      if (!freq || freq <= 0) return false;

      const daysSinceCreated = Math.floor(
        (now.getTime() - alert.createdAt.getTime()) / DAY_MS
      );

      if (daysSinceCreated <= 0) return false;
      if (daysSinceCreated % freq !== 0) return false;

      // Dedup: only send once per cadence window. If we already sent within
      // the last `freq` days, skip — this also covers the cron running twice in a day.
      if (alert.lastReminderSentAt) {
        const daysSinceSent = Math.floor(
          (now.getTime() - alert.lastReminderSentAt.getTime()) / DAY_MS
        );
        if (daysSinceSent < freq) return false;
      }

      // If there's a deadline that has already passed, skip.
      if (alert.deadline && alert.deadline.getTime() < now.getTime()) {
        return false;
      }

      // Skip alerts whose underlying debt is already paid.
      if (alert.debt && alert.debt.status === "paid") return false;

      return true;
    });
  }

  /**
   * Mark an alert as having had a reminder email sent at the given time.
   */
  async markReminderSent(alertId: number, sentAt: Date) {
    return prisma.alert.update({
      where: { id: alertId },
      data: { lastReminderSentAt: sentAt },
    });
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
