import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "../lib/prisma";
import { recurringPaymentService } from "./recurring-payment.service";
import {
  BORROWER_ID,
  LENDER_ID,
  makeRecurringPayment,
  makeUser,
  OUTSIDER_ID,
  type MockPrisma,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createRecurringPayment", () => {
  const borrowers = [
    { userId: BORROWER_ID, splitPercentage: 100 },
  ];

  it("creates the payment and borrower splits in one transaction", async () => {
    db.user.findUnique.mockResolvedValueOnce(makeUser({ id: BORROWER_ID }));

    const complete = makeRecurringPayment({
      id: 1,
      lender: makeUser(),
      borrowers: [
        {
          userId: BORROWER_ID,
          splitPercentage: 100,
          user: makeUser({ id: BORROWER_ID }),
        },
      ],
    });
    const tx = {
      recurringPayment: {
        create: vi.fn().mockResolvedValue(makeRecurringPayment({ id: 1 })),
        findUnique: vi.fn().mockResolvedValue(complete),
      },
      recurringPaymentBorrower: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    db.$transaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );

    const payment = await recurringPaymentService.createRecurringPayment({
      amount: 100,
      frequency: 30,
      lenderId: LENDER_ID,
      borrowers,
    });

    expect(payment.status).toBe("active");
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.recurringPaymentBorrower.createMany).toHaveBeenCalledWith({
      data: [
        { recurringPaymentId: 1, userId: BORROWER_ID, splitPercentage: 100 },
      ],
    });
  });

  it.each([
    [{ amount: 0, frequency: 30, borrowers }, "Valid amount is required"] as const,
    [{ amount: -1, frequency: 30, borrowers }, "Valid amount is required"] as const,
    [{ amount: 100, frequency: 0, borrowers }, "Frequency must be at least 1 day"] as const,
    [{ amount: 100, frequency: 30, borrowers: [] }, "At least one borrower is required"] as const,
    [
      {
        amount: 100,
        frequency: 30,
        borrowers: [
          { userId: BORROWER_ID, splitPercentage: 80 },
          { userId: OUTSIDER_ID, splitPercentage: 30 },
        ],
      },
      "Split percentages must sum to 100%",
    ] as const,
    [
      {
        amount: 100,
        frequency: 30,
        borrowers: [
          { userId: BORROWER_ID, splitPercentage: 100 },
          { userId: OUTSIDER_ID, splitPercentage: 0 },
        ],
      },
      "All split percentages must be positive",
    ] as const,
  ])("rejects invalid input %#", async (params, message) => {
    await expect(
      recurringPaymentService.createRecurringPayment(params as never),
    ).rejects.toThrow(message);
  });

  it("rejects unknown borrowers and duplicate borrowers", async () => {
    db.user.findUnique.mockResolvedValue(makeUser());
    db.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      recurringPaymentService.createRecurringPayment({
        amount: 100,
        frequency: 30,
        lenderId: LENDER_ID,
        borrowers: [{ userId: "ghost", splitPercentage: 100 }],
      }),
    ).rejects.toThrow("Borrower with ID ghost not found");

    await expect(
      recurringPaymentService.createRecurringPayment({
        amount: 100,
        frequency: 30,
        lenderId: LENDER_ID,
        borrowers: [
          { userId: BORROWER_ID, splitPercentage: 50 },
          { userId: BORROWER_ID, splitPercentage: 50 },
        ],
      }),
    ).rejects.toThrow("Cannot add the same borrower multiple times");
  });

  it("handles multi-borrower splits that sum to 100", async () => {
    const split = [
      { userId: BORROWER_ID, splitPercentage: 60 },
      { userId: OUTSIDER_ID, splitPercentage: 40 },
    ];
    db.user.findUnique.mockResolvedValue(makeUser());

    const tx = {
      recurringPayment: {
        create: vi.fn().mockResolvedValue(makeRecurringPayment({ id: 2 })),
        findUnique: vi
          .fn()
          .mockResolvedValue(
            makeRecurringPayment({ id: 2, lender: makeUser(), borrowers: [] }),
          ),
      },
      recurringPaymentBorrower: { createMany: vi.fn().mockResolvedValue({ count: 2 }) },
    };
    db.$transaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );

    await recurringPaymentService.createRecurringPayment({
      amount: 100,
      frequency: 30,
      lenderId: LENDER_ID,
      borrowers: split,
    });

    expect(tx.recurringPaymentBorrower.createMany).toHaveBeenCalledWith({
      data: [
        { recurringPaymentId: 2, userId: BORROWER_ID, splitPercentage: 60 },
        { recurringPaymentId: 2, userId: OUTSIDER_ID, splitPercentage: 40 },
      ],
    });
  });
});

describe("getUserRecurringPayments", () => {
  it("defaults to payments where the user is lender or borrower", async () => {
    db.recurringPayment.findMany.mockResolvedValueOnce([]);
    await recurringPaymentService.getUserRecurringPayments(LENDER_ID);
    expect(db.recurringPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ lenderId: LENDER_ID }, { borrowers: { some: { userId: LENDER_ID } } }],
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("applies type and status filters", async () => {
    db.recurringPayment.findMany.mockResolvedValueOnce([]);
    await recurringPaymentService.getUserRecurringPayments(LENDER_ID, {
      type: "lending",
      status: "active",
    });
    expect(db.recurringPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lenderId: LENDER_ID, status: "active" },
      }),
    );
  });
});

describe("toggleStatus", () => {
  it("flips active -> inactive for the lender", async () => {
    db.recurringPayment.findUnique.mockResolvedValueOnce(
      makeRecurringPayment({ id: 5, status: "active", lender: makeUser() }),
    );
    db.recurringPayment.update.mockResolvedValueOnce(
      makeRecurringPayment({ id: 5, status: "inactive", lender: makeUser() }),
    );

    const payment = await recurringPaymentService.toggleStatus(5, LENDER_ID);

    expect(payment.status).toBe("inactive");
    expect(db.recurringPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "inactive" } }),
    );
  });

  it("flips inactive -> active and blocks non-lenders + unknown ids", async () => {
    db.recurringPayment.findUnique.mockResolvedValueOnce(
      makeRecurringPayment({ id: 5, status: "inactive", lender: makeUser() }),
    );
    db.recurringPayment.update.mockResolvedValueOnce(
      makeRecurringPayment({ id: 5, status: "active", lender: makeUser() }),
    );

    const payment = await recurringPaymentService.toggleStatus(5, LENDER_ID);
    expect(payment.status).toBe("active");

    db.recurringPayment.findUnique.mockResolvedValueOnce(
      makeRecurringPayment({ id: 5, status: "active", lender: makeUser() }),
    );
    await expect(recurringPaymentService.toggleStatus(5, OUTSIDER_ID)).rejects.toThrow(
      "You don't have permission to update this recurring payment",
    );

    db.recurringPayment.findUnique.mockResolvedValueOnce(null);
    await expect(recurringPaymentService.toggleStatus(999, LENDER_ID)).rejects.toThrow(
      "Recurring payment not found",
    );
  });
});
