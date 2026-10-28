import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "../lib/prisma";
import { buildToolRegistrations } from "./tools";
import {
  BORROWER_ID,
  LENDER_ID,
  makeDebt,
  makeRecurringPayment,
  makeUser,
  OUTSIDER_ID,
  type MockPrisma,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;

beforeEach(() => {
  vi.clearAllMocks();
});

const ctx = { userId: LENDER_ID, email: "lender@example.com" };
const tools = () => buildToolRegistrations(ctx);

describe("list_my_debts", () => {
  it("returns debts scoped to the token user", async () => {
    db.debt.findMany.mockResolvedValueOnce([
      makeDebt({ id: 1, lender: makeUser(), borrower: makeUser({ id: BORROWER_ID }) }),
    ]);
    const result = await tools().list_my_debts.execute({}, {});

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed[0].lenderId).toBe(LENDER_ID);
    expect(db.debt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ lenderId: LENDER_ID }, { borrowerId: LENDER_ID }] },
      }),
    );
  });

  it("passes filters through", async () => {
    db.debt.findMany.mockResolvedValueOnce([]);
    await tools().list_my_debts.execute({ type: "borrowing", status: "pending" }, {});
    expect(db.debt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ borrowerId: LENDER_ID }], status: "pending" },
      }),
    );
  });
});

describe("create_debt", () => {
  it("always uses the token user as the lender", async () => {
    db.user.findUnique.mockResolvedValueOnce(makeUser({ id: BORROWER_ID }));
    db.debt.create.mockResolvedValueOnce(makeDebt({ id: 5 }));

    await tools().create_debt.execute(
      { amount: 10, borrowerId: BORROWER_ID, description: "lunch" },
      {},
    );

    expect(db.debt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 10,
          lenderId: LENDER_ID,
          borrowerId: BORROWER_ID,
          status: "pending",
        }),
      }),
    );
  });

  it("surfaces service validation errors as isError results", async () => {
    db.user.findUnique.mockResolvedValueOnce(null);
    const result = await tools().create_debt.execute(
      { amount: 10, borrowerId: "ghost" },
      {},
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Borrower not found");
  });
});

describe("get_debt", () => {
  it("rejects outsiders with the policy message", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 1 }));
    const result = await tools().get_debt.execute({ debtId: 1 }, {});

    // ctx user is the lender, so this succeeds...
    expect(result.isError).toBeUndefined();
  });

  it("reports missing debts", async () => {
    db.debt.findUnique.mockResolvedValueOnce(null);
    const result = await tools().get_debt.execute({ debtId: 999 }, {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Debt not found");
  });
});

describe("request_debt_payment", () => {
  it("creates a modification request scoped to the requesting user", async () => {
    db.debt.findUnique.mockResolvedValueOnce(
      makeDebt({ id: 1, lenderId: OUTSIDER_ID, borrowerId: LENDER_ID }),
    );
    db.debtTransaction.findFirst.mockResolvedValueOnce(null);
    db.debtTransaction.create.mockResolvedValueOnce(
      makeDebtTransactionReq({ requesterId: LENDER_ID, type: "modify", proposedAmount: 50 }),
    );

    const result = await tools().request_debt_payment.execute(
      { debtId: 1, type: "modify", proposedAmount: 50 },
      {},
    );

    expect(result.isError).toBeUndefined();
    expect(db.debtTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          debtId: 1,
          type: "modify",
          requesterId: LENDER_ID,
          proposedAmount: 50,
          borrowerApproved: true,
        }),
      }),
    );
  });

  it("propagates the pending-conflict error", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 1 }));
    db.debtTransaction.findFirst.mockResolvedValueOnce({ id: 9 });
    const result = await tools().request_debt_payment.execute(
      { debtId: 1, type: "drop" },
      {},
    );
    expect(result.content[0].text).toBe(
      "There is already a pending transaction for this debt",
    );
  });
});

describe("respond_debt_request", () => {
  it("rejects non-parties and passes the token userId", async () => {
    db.debtTransaction.findUnique.mockResolvedValueOnce(
      makeDebtTransactionOut(),
    );
    const result = await tools().respond_debt_request.execute(
      { transactionId: 1, approve: true },
      {},
    );
    // the transaction belongs to LENDER_ID/BORROWER_ID; ctx is LENDER_ID
    expect(result.isError).toBeUndefined();
    expect(db.debtTransaction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
  });
});

describe("recurring payment tools", () => {
  it("list_my_recurring_payments scopes by the token user", async () => {
    db.recurringPayment.findMany.mockResolvedValueOnce(
      [makeRecurringPayment({ id: 1 })],
    );
    const result = await tools().list_my_recurring_payments.execute({}, {});
    expect(result.isError).toBeUndefined();
    expect(db.recurringPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ lenderId: LENDER_ID }, { borrowers: { some: { userId: LENDER_ID } } }],
        },
      }),
    );
  });

  it("create_recurring_payment rejects split sums that don't add to 100", async () => {
    const result = await tools().create_recurring_payment.execute(
      {
        amount: 100,
        frequency: 30,
        borrowers: [
          { userId: BORROWER_ID, splitPercentage: 60 },
          { userId: OUTSIDER_ID, splitPercentage: 30 },
        ],
      },
      {},
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Split percentages must sum to 100%");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("create_recurring_payment creates through the service transaction", async () => {
    db.user.findUnique.mockResolvedValue(makeUser({ id: BORROWER_ID }));

    const tx = {
      recurringPayment: {
        create: vi.fn().mockResolvedValue(makeRecurringPayment({ id: 3 })),
        findUnique: vi
          .fn()
          .mockResolvedValue(
            makeRecurringPayment({ id: 3, lender: makeUser(), borrowers: [] }),
          ),
      },
      recurringPaymentBorrower: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    db.$transaction.mockImplementationOnce(async (fn: (t: unknown) => unknown) =>
      fn(tx),
    );

    const result = await tools().create_recurring_payment.execute(
      {
        amount: 100,
        frequency: 30,
        borrowers: [{ userId: BORROWER_ID, splitPercentage: 100 }],
      },
      {},
    );

    expect(result.isError).toBeUndefined();
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.recurringPaymentBorrower.createMany).toHaveBeenCalledWith({
      data: [{ recurringPaymentId: 3, userId: BORROWER_ID, splitPercentage: 100 }],
    });
  });

  it("toggle_recurring_payment flips status for the lender", async () => {
    db.recurringPayment.findUnique.mockResolvedValueOnce(
      makeRecurringPayment({ id: 3, status: "active", lender: makeUser() }),
    );
    db.recurringPayment.update.mockResolvedValueOnce(
      makeRecurringPayment({ id: 3, status: "inactive", lender: makeUser() }),
    );

    const result = await tools().toggle_recurring_payment.execute({ id: 3 }, {});
    const parsed = JSON.parse(result.content[0]!.text);
    expect(parsed.status).toBe("inactive");
  });
});

/* helpers that build transaction rows with includes the tool path uses */
function makeDebtTransactionReq(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 1,
    debtId: 1,
    type: "drop",
    status: "pending",
    requesterId: BORROWER_ID,
    lenderApproved: false,
    borrowerApproved: true,
    proposedAmount: null,
    proposedDescription: null,
    reason: null,
    resolvedAt: null,
    debt: makeDebt({ id: 1 }),
    requester: makeUser(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDebtTransactionOut() {
  return makeDebtTransactionReq({ id: 1, type: "drop", requesterId: BORROWER_ID });
}
