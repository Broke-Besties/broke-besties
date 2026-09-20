import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "@/lib/prisma";
import { recurringPaymentService } from "@/services/recurring-payment.service";
import { BORROWER_ID, LENDER_ID, MockPrisma } from "../test/mocks";

const db = prisma as unknown as MockPrisma;

describe("recurringPaymentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createRecurringPayment", () => {
    const base = {
      amount: 100,
      frequency: 30,
      lenderId: LENDER_ID,
      borrowers: [
        { userId: BORROWER_ID, splitPercentage: 100 },
      ],
    };

    it("validates amount, frequency and borrowers", async () => {
      await expect(
        recurringPaymentService.createRecurringPayment({ ...base, amount: 0 }),
      ).rejects.toThrow("Valid amount is required");
      await expect(
        recurringPaymentService.createRecurringPayment({ ...base, frequency: 0 }),
      ).rejects.toThrow("Frequency must be at least 1 day");
      await expect(
        recurringPaymentService.createRecurringPayment({ ...base, borrowers: [] }),
      ).rejects.toThrow("At least one borrower is required");
    });

    it("validates the split percentages", async () => {
      await expect(
        recurringPaymentService.createRecurringPayment({
          ...base,
          borrowers: [
            { userId: BORROWER_ID, splitPercentage: 50 },
            { userId: "u3", splitPercentage: 40 },
          ],
        }),
      ).rejects.toThrow("Split percentages must sum to 100%");

      await expect(
        recurringPaymentService.createRecurringPayment({
          ...base,
          borrowers: [
            { userId: BORROWER_ID, splitPercentage: 110 },
            { userId: "u3", splitPercentage: -10 },
          ],
        }),
      ).rejects.toThrow("All split percentages must be positive");
    });

    it("rejects unknown and duplicate borrowers", async () => {
      db.user.findUnique.mockResolvedValue(null);
      await expect(recurringPaymentService.createRecurringPayment(base)).rejects.toThrow(
        `Borrower with ID ${BORROWER_ID} not found`,
      );

      db.user.findUnique.mockResolvedValue({ id: BORROWER_ID });
      await expect(
        recurringPaymentService.createRecurringPayment({
          ...base,
          borrowers: [
            { userId: BORROWER_ID, splitPercentage: 50 },
            { userId: BORROWER_ID, splitPercentage: 50 },
          ],
        }),
      ).rejects.toThrow("Cannot add the same borrower multiple times");
    });

    it("creates the payment and borrowers inside a transaction", async () => {
      db.user.findUnique.mockResolvedValue({ id: BORROWER_ID });
      const payment = { id: 1, amount: 100, lenderId: LENDER_ID, borrowers: [] };
      const tx = {
        recurringPayment: {
          create: vi.fn().mockResolvedValue(payment),
          findUnique: vi.fn().mockResolvedValue({
            ...payment,
            lender: { id: LENDER_ID },
            borrowers: [{ user: { id: BORROWER_ID } }],
          }),
        },
        recurringPaymentBorrower: { createMany: vi.fn() },
      };
      db.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => fn(tx));

      const result = await recurringPaymentService.createRecurringPayment(base);

      expect(result.borrowers).toHaveLength(1);
      expect(tx.recurringPayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ amount: 100, status: "active" }),
        }),
      );
      expect(tx.recurringPaymentBorrower.createMany).toHaveBeenCalledWith({
        data: [{ recurringPaymentId: 1, userId: BORROWER_ID, splitPercentage: 100 }],
      });
    });
  });

  describe("getUserRecurringPayments", () => {
    it("builds the where clause from type and status filters", async () => {
      db.recurringPayment.findMany.mockResolvedValueOnce([]);

      await recurringPaymentService.getUserRecurringPayments(LENDER_ID, {
        type: "lending",
        status: "active",
      });
      expect(db.recurringPayment.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { lenderId: LENDER_ID, status: "active" },
        }),
      );

      await recurringPaymentService.getUserRecurringPayments(LENDER_ID, {
        type: "borrowing",
      });
      expect(db.recurringPayment.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: { borrowers: { some: { userId: LENDER_ID } } },
        }),
      );

      await recurringPaymentService.getUserRecurringPayments(LENDER_ID);
      expect(db.recurringPayment.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: {
            OR: [{ lenderId: LENDER_ID }, { borrowers: { some: { userId: LENDER_ID } } }],
          },
        }),
      );
    });
  });

  describe("updateRecurringPayment", () => {
    it("is lender-only", async () => {
      db.recurringPayment.findUnique.mockResolvedValueOnce({ lenderId: "other" });

      await expect(
        recurringPaymentService.updateRecurringPayment(1, LENDER_ID, { amount: 5 }),
      ).rejects.toThrow("You don't have permission to update this recurring payment");
    });

    it("validates amount, frequency and status", async () => {
      db.recurringPayment.findUnique.mockResolvedValue({ lenderId: LENDER_ID });

      await expect(
        recurringPaymentService.updateRecurringPayment(1, LENDER_ID, { amount: 0 }),
      ).rejects.toThrow("Amount must be positive");
      await expect(
        recurringPaymentService.updateRecurringPayment(1, LENDER_ID, { frequency: 0 }),
      ).rejects.toThrow("Frequency must be at least 1 day");
      await expect(
        recurringPaymentService.updateRecurringPayment(1, LENDER_ID, { status: "weird" }),
      ).rejects.toThrow('Status must be either "active" or "inactive"');
    });

    it("applies the allowed updates", async () => {
      db.recurringPayment.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });
      db.recurringPayment.update.mockResolvedValueOnce({ id: 1, amount: 50 });

      const payment = await recurringPaymentService.updateRecurringPayment(
        1,
        LENDER_ID,
        { amount: 50, frequency: 7, status: "inactive" },
      );

      expect(payment.amount).toBe(50);
      expect(db.recurringPayment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { amount: 50, frequency: 7, status: "inactive" },
        }),
      );
    });
  });

  describe("toggleStatus", () => {
    it("flips active to inactive and back", async () => {
      db.recurringPayment.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });
      db.recurringPayment.findUnique.mockResolvedValueOnce({ status: "active" });
      db.recurringPayment.update.mockResolvedValueOnce({ id: 1, status: "inactive" });

      let result = await recurringPaymentService.toggleStatus(1, LENDER_ID);
      expect(result.status).toBe("inactive");

      db.recurringPayment.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });
      db.recurringPayment.findUnique.mockResolvedValueOnce({ status: "inactive" });
      db.recurringPayment.update.mockResolvedValueOnce({ id: 1, status: "active" });

      result = await recurringPaymentService.toggleStatus(1, LENDER_ID);
      expect(result.status).toBe("active");
    });

    it("throws when the payment disappeared after the permission check", async () => {
      db.recurringPayment.findUnique
        .mockResolvedValueOnce({ lenderId: LENDER_ID })
        .mockResolvedValueOnce(null);

      await expect(recurringPaymentService.toggleStatus(1, LENDER_ID)).rejects.toThrow(
        "Recurring payment not found",
      );
    });
  });

  describe("deleteRecurringPayment", () => {
    it("is lender-only", async () => {
      db.recurringPayment.findUnique.mockResolvedValueOnce({ lenderId: "other" });
      await expect(recurringPaymentService.deleteRecurringPayment(1, LENDER_ID)).rejects.toThrow(
        "Only the lender can delete this recurring payment",
      );

      db.recurringPayment.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });
      await recurringPaymentService.deleteRecurringPayment(1, LENDER_ID);
      expect(db.recurringPayment.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
