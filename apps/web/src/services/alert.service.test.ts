import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "@/lib/prisma";
import { alertService } from "@/services/alert.service";
import { BORROWER_ID, LENDER_ID, MockPrisma, makeDebt } from "../test/mocks";

const db = prisma as unknown as MockPrisma;

const DAY_MS = 24 * 60 * 60 * 1000;

function makeAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    message: null,
    deadline: null,
    lenderId: LENDER_ID,
    borrowerId: BORROWER_ID,
    isActive: true,
    reminderFrequencyDays: 3,
    lastReminderSentAt: null,
    createdAt: new Date(Date.now() - 6 * DAY_MS),
    debt: null,
    recurringPayment: null,
    ...overrides,
  };
}

describe("alertService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAlertForDebt", () => {
    it("throws when the debt is missing", async () => {
      db.debt.findUnique.mockResolvedValueOnce(null);

      await expect(
        alertService.createAlertForDebt({ debtId: 1, userId: LENDER_ID }),
      ).rejects.toThrow("Debt not found");
    });

    it("only the lender can create alerts and only one alert per debt", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      await expect(
        alertService.createAlertForDebt({ debtId: 1, userId: BORROWER_ID }),
      ).rejects.toThrow("Only the lender can create alerts for this debt");

      db.debt.findUnique.mockResolvedValueOnce(makeDebt({ alertId: 5 }));
      await expect(
        alertService.createAlertForDebt({ debtId: 1, userId: LENDER_ID }),
      ).rejects.toThrow("This debt already has an alert");
    });

    it("creates the alert and links it to the debt inside a transaction", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      const alert = makeAlert();
      const tx = {
        alert: { create: vi.fn().mockResolvedValue(alert) },
        debt: { update: vi.fn() },
      };
      db.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => fn(tx));

      const result = await alertService.createAlertForDebt({
        debtId: 1,
        message: "Pay up",
        reminderFrequencyDays: 2,
        userId: LENDER_ID,
      });

      expect(result).toEqual(alert);
      expect(tx.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lenderId: LENDER_ID,
            borrowerId: BORROWER_ID,
            isActive: true,
            reminderFrequencyDays: 2,
          }),
        }),
      );
      expect(tx.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { alertId: 1 } }),
      );
    });
  });

  describe("createAlertForRecurringPayment", () => {
    it("throws when missing / not lender / no borrower", async () => {
      db.recurringPayment.findUnique.mockResolvedValueOnce(null);
      await expect(
        alertService.createAlertForRecurringPayment({
          recurringPaymentId: 1,
          userId: LENDER_ID,
        }),
      ).rejects.toThrow("Recurring payment not found");

      db.recurringPayment.findUnique.mockResolvedValueOnce({
        id: 1,
        lenderId: "someone",
        alertId: null,
        borrowers: [{ userId: BORROWER_ID }],
      });
      await expect(
        alertService.createAlertForRecurringPayment({
          recurringPaymentId: 1,
          userId: LENDER_ID,
        }),
      ).rejects.toThrow(
        "Only the lender can create alerts for this recurring payment",
      );

      db.recurringPayment.findUnique.mockResolvedValueOnce({
        id: 1,
        lenderId: LENDER_ID,
        alertId: null,
        borrowers: [],
      });
      await expect(
        alertService.createAlertForRecurringPayment({
          recurringPaymentId: 1,
          userId: LENDER_ID,
        }),
      ).rejects.toThrow("Recurring payment must have at least one borrower");
    });

    it("creates an alert without a deadline using the first borrower", async () => {
      db.recurringPayment.findUnique.mockResolvedValueOnce({
        id: 1,
        lenderId: LENDER_ID,
        alertId: null,
        groupId: null,
        borrowers: [{ userId: BORROWER_ID }, { userId: "u3" }],
      });
      const tx = {
        alert: { create: vi.fn().mockResolvedValue(makeAlert()) },
        recurringPayment: { update: vi.fn() },
      };
      db.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => fn(tx));

      await alertService.createAlertForRecurringPayment({
        recurringPaymentId: 1,
        userId: LENDER_ID,
      });

      expect(tx.alert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            deadline: null,
            borrowerId: BORROWER_ID,
          }),
        }),
      );
      expect(tx.recurringPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { alertId: 1 } }),
      );
    });
  });

  describe("getAlertById", () => {
    it("throws when missing and enforces canView", async () => {
      db.alert.findUnique.mockResolvedValueOnce(null);
      await expect(alertService.getAlertById(1, LENDER_ID)).rejects.toThrow(
        "Alert not found",
      );

      db.alert.findUnique.mockResolvedValueOnce(makeAlert());
      await expect(alertService.getAlertById(1, "u3")).rejects.toThrow(
        "You don't have permission to view this alert",
      );
    });
  });

  describe("updateAlert", () => {
    it("blocks non-lenders and passes through allowed updates", async () => {
      db.alert.findUnique.mockResolvedValueOnce(null);
      await expect(
        alertService.updateAlert(1, LENDER_ID, { message: "x" }),
      ).rejects.toThrow("You don't have permission to update this alert");

      db.alert.findUnique.mockResolvedValueOnce({ lenderId: "other" });
      await expect(
        alertService.updateAlert(1, LENDER_ID, { message: "x" }),
      ).rejects.toThrow("You don't have permission to update this alert");

      db.alert.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });
      db.alert.update.mockResolvedValueOnce(makeAlert({ message: "new" }));

      const alert = await alertService.updateAlert(1, LENDER_ID, {
        message: "new",
        isActive: false,
      });

      expect(alert.message).toBe("new");
      expect(db.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { message: "new", isActive: false },
        }),
      );
    });
  });

  describe("optOutOfReminders", () => {
    it("is borrower-only and nulls the reminder frequency", async () => {
      db.alert.findUnique.mockResolvedValueOnce({ id: 1, borrowerId: BORROWER_ID });
      await expect(alertService.optOutOfReminders(1, LENDER_ID)).rejects.toThrow(
        "Only the borrower can opt out of reminders for this alert",
      );

      db.alert.findUnique.mockResolvedValueOnce({ id: 1, borrowerId: BORROWER_ID });
      db.alert.update.mockResolvedValueOnce(makeAlert({ reminderFrequencyDays: null }));

      const alert = await alertService.optOutOfReminders(1, BORROWER_ID);
      expect(alert.reminderFrequencyDays).toBeNull();
      expect(db.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { reminderFrequencyDays: null } }),
      );
    });
  });

  describe("getAlertsDueForReminder (pure filter over fetched alerts)", () => {
    it("returns only alerts matching the cadence rules", async () => {
      const now = new Date();
      const candidates = [
        // due: created 6 days ago, freq 3, never sent
        makeAlert({ id: 1, createdAt: new Date(now.getTime() - 6 * DAY_MS) }),
        // not due: created 5 days ago, freq 3
        makeAlert({ id: 2, createdAt: new Date(now.getTime() - 5 * DAY_MS) }),
        // not due: created today (daysSinceCreated <= 0)
        makeAlert({ id: 3, createdAt: now }),
        // deduped: sent 1 day ago with freq 3
        makeAlert({
          id: 4,
          createdAt: new Date(now.getTime() - 6 * DAY_MS),
          lastReminderSentAt: new Date(now.getTime() - 1 * DAY_MS),
        }),
        // past deadline
        makeAlert({
          id: 5,
          createdAt: new Date(now.getTime() - 6 * DAY_MS),
          deadline: new Date(now.getTime() - DAY_MS),
        }),
        // underlying debt already paid
        makeAlert({
          id: 6,
          createdAt: new Date(now.getTime() - 6 * DAY_MS),
          debt: { status: "paid" },
        }),
        // invalid frequency
        makeAlert({ id: 7, reminderFrequencyDays: 0 }),
      ];
      db.alert.findMany.mockResolvedValueOnce(candidates);

      const due = await alertService.getAlertsDueForReminder(now);

      expect(due.map((a) => a.id)).toEqual([1]);
    });

    it("allows resending after the cadence window has passed", async () => {
      const now = new Date();
      db.alert.findMany.mockResolvedValueOnce([
        makeAlert({
          id: 9,
          createdAt: new Date(now.getTime() - 6 * DAY_MS),
          lastReminderSentAt: new Date(now.getTime() - 3 * DAY_MS),
        }),
      ]);

      const due = await alertService.getAlertsDueForReminder(now);

      expect(due).toHaveLength(1);
    });
  });

  describe("deleteAlert", () => {
    it("is lender-only and unlinks then deletes in a transaction", async () => {
      db.alert.findUnique.mockResolvedValueOnce({ lenderId: "other" });
      await expect(alertService.deleteAlert(1, LENDER_ID)).rejects.toThrow(
        "Only the lender can delete this alert",
      );

      db.alert.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });
      const tx = {
        debt: {
          findFirst: vi.fn().mockResolvedValue({ id: 5, alertId: 1 }),
          update: vi.fn(),
        },
        recurringPayment: {
          findFirst: vi.fn().mockResolvedValue(null),
          update: vi.fn(),
        },
        alert: { delete: vi.fn() },
      };
      db.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => fn(tx));

      await alertService.deleteAlert(1, LENDER_ID);

      expect(tx.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { alertId: null } }),
      );
      expect(tx.alert.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
