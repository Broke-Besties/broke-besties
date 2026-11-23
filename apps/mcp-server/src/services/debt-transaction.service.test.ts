import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "../lib/prisma";
import { debtTransactionService } from "./debt-transaction.service";
import {
  BORROWER_ID,
  LENDER_ID,
  makeDebt,
  makeDebtTransaction,
  makeUser,
  OUTSIDER_ID,
  type MockPrisma,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTransaction", () => {
  const base = { debtId: 1, requesterId: BORROWER_ID, type: "drop" as const };

  it("auto-approves for the requesting party and records the reason", async () => {
    db.debt.findUnique.mockResolvedValueOnce({ ...makeDebt({ id: 1 }) });
    db.debtTransaction.create.mockImplementationOnce(
      ({ data }: { data: Record<string, unknown> }) =>
        makeDebtTransaction({ ...data }),
    );

    const tx = await debtTransactionService.createTransaction({
      ...base,
      reason: "we split it",
    });

    expect(tx.status).toBe("pending");
    expect(db.debtTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          debtId: 1,
          type: "drop",
          requesterId: BORROWER_ID,
          reason: "we split it",
          lenderApproved: false,
          borrowerApproved: true,
        }),
      }),
    );
  });

  it("is not authorized for a non-party", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 1 }));
    await expect(
      debtTransactionService.createTransaction({
        ...base,
        requesterId: OUTSIDER_ID,
      }),
    ).rejects.toThrow("You are not authorized to create a transaction for this debt");
  });

  it("rejects unknown debts", async () => {
    db.debt.findUnique.mockResolvedValueOnce(null);
    await expect(
      debtTransactionService.createTransaction(base),
    ).rejects.toThrow("Debt not found");
  });

  it("validates modify requests", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 1 }));
    await expect(
      debtTransactionService.createTransaction({
        debtId: 1,
        requesterId: LENDER_ID,
        type: "modify",
      }),
    ).rejects.toThrow(
      "Modification must include at least one change (amount or description)",
    );

    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 1 }));
    await expect(
      debtTransactionService.createTransaction({
        debtId: 1,
        requesterId: LENDER_ID,
        type: "modify",
        proposedAmount: 0,
      }),
    ).rejects.toThrow("Proposed amount must be positive");
  });

  it("rejects when another pending transaction exists", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 1 }));
    db.debtTransaction.findFirst.mockResolvedValueOnce(
      makeDebtTransaction({ id: 99 }),
    );
    await expect(
      debtTransactionService.createTransaction(base),
    ).rejects.toThrow("There is already a pending transaction for this debt");
  });
});

describe("respondToTransaction", () => {
  it("rejects without applying any change", async () => {
    db.debtTransaction.findUnique.mockResolvedValueOnce(
      makeDebtTransaction({ id: 3, debt: makeDebt() }),
    );
    db.debtTransaction.update.mockResolvedValueOnce(
      makeDebtTransaction({ id: 3, status: "rejected" }),
    );

    const result = await debtTransactionService.respondToTransaction({
      transactionId: 3,
      userId: LENDER_ID,
      approve: false,
    });

    expect(result.debtUpdated).toBe(false);
    expect(db.debtTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "rejected", resolvedAt: expect.any(Date) },
      }),
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("applies the change when both parties approve (borrower auto-approved)", async () => {
    const pending = makeDebtTransaction({
      id: 3,
      type: "modify",
      borrowerApproved: true,
      proposedAmount: 60,
      debt: makeDebt({ id: 1 }),
      requester: makeUser({ id: BORROWER_ID }),
    });
    db.debtTransaction.findUnique.mockResolvedValueOnce(pending);

    const approvedTx = { ...pending, status: "approved", lenderApproved: true };
    const tx = {
      debtTransaction: { update: vi.fn().mockResolvedValue(approvedTx) },
      debt: { update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
      alert: { update: vi.fn() },
    };
    db.$transaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );

    const result = await debtTransactionService.respondToTransaction({
      transactionId: 3,
      userId: LENDER_ID,
      approve: true,
    });

    expect(result.debtUpdated).toBe(true);
    expect(tx.debtTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lenderApproved: true, status: "approved" }),
      }),
    );
    expect(tx.debt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { amount: 60 } }),
    );
  });

  it("marks debts paid on confirmed confirm_paid", async () => {
    db.debtTransaction.findUnique.mockResolvedValueOnce(
      makeDebtTransaction({
        id: 3,
        type: "confirm_paid",
        requesterId: BORROWER_ID,
        debt: makeDebt({ id: 1, alertId: 9 }),
        requester: makeUser({ id: BORROWER_ID }),
      }),
    );
    const tx = {
      debtTransaction: {
        update: vi
          .fn()
          .mockResolvedValue(
            makeDebtTransaction({ id: 3, type: "confirm_paid", status: "approved" }),
          ),
      },
      debt: {
        update: vi
          .fn()
          .mockResolvedValue(makeDebt({ id: 1, status: "paid", alertId: 9 })),
      },
      alert: { update: vi.fn() },
    };
    db.$transaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );

    const result = await debtTransactionService.respondToTransaction({
      transactionId: 3,
      userId: LENDER_ID,
      approve: true,
    });

    expect(result.debtUpdated).toBe(true);
    expect(tx.debt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "paid" } }),
    );
    expect(tx.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });

  it("deletes the debt on an approved drop request", async () => {
    db.debtTransaction.findUnique.mockResolvedValueOnce(
      makeDebtTransaction({
        id: 3,
        type: "drop",
        requesterId: BORROWER_ID,
        debt: makeDebt({ id: 1, alertId: 9 }),
        requester: makeUser({ id: BORROWER_ID }),
      }),
    );
    const tx = {
      debtTransaction: {
        update: vi
          .fn()
          .mockResolvedValue(
            makeDebtTransaction({ id: 3, type: "drop", status: "approved" }),
          ),
      },
      debt: {
        delete: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({ alertId: 9 }),
        update: vi.fn(),
      },
      alert: { update: vi.fn() },
    };
    db.$transaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );

    await debtTransactionService.respondToTransaction({
      transactionId: 3,
      userId: LENDER_ID,
      approve: true,
    });

    expect(tx.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
    expect(tx.debt.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it("records a single approval and waits for the second party when only one has approved", async () => {
    db.debtTransaction.findUnique.mockResolvedValueOnce(
      makeDebtTransaction({
        id: 3,
        requesterId: BORROWER_ID,
        borrowerApproved: false,
        debt: makeDebt({ id: 1 }),
      }),
    );
    db.debtTransaction.update.mockResolvedValueOnce(
      makeDebtTransaction({ id: 3, lenderApproved: true }),
    );

    const result = await debtTransactionService.respondToTransaction({
      transactionId: 3,
      userId: LENDER_ID,
      approve: true,
    });

    expect(result.debtUpdated).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.debtTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lenderApproved: true } }),
    );
  });

  it.each([
    [null, "Transaction not found"] as const,
    [makeDebtTransaction({ id: 3, status: "approved" }), "This transaction has already been processed"] as const,
  ])("rejects invalid transactions %#", async (row, message) => {
    db.debtTransaction.findUnique.mockResolvedValueOnce(row);
    await expect(
      debtTransactionService.respondToTransaction({
        transactionId: 3,
        userId: LENDER_ID,
        approve: true,
      }),
    ).rejects.toThrow(message);
  });

  it("rejects a non-party responder", async () => {
    db.debtTransaction.findUnique.mockResolvedValueOnce(
      makeDebtTransaction({ id: 3, debt: makeDebt({ id: 1 }) }),
    );
    await expect(
      debtTransactionService.respondToTransaction({
        transactionId: 3,
        userId: OUTSIDER_ID,
        approve: true,
      }),
    ).rejects.toThrow("You are not authorized to respond to this transaction");
  });

  it("returns the requester on the read path for a party of the debt", async () => {
    db.debt.findUnique.mockResolvedValueOnce(
      makeDebt({
        id: 1,
        lender: makeUser(),
        borrower: makeUser({ id: BORROWER_ID }),
      }),
    );
    db.debtTransaction.findMany.mockResolvedValueOnce([]);
    expect(await debtTransactionService.getDebtTransactions(1, LENDER_ID)).toEqual(
      [],
    );
    expect(db.debtTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { debtId: 1 } }),
    );
  });
});
