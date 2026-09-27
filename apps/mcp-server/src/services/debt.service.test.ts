import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "../lib/prisma";
import { debtService } from "./debt.service";
import {
  BORROWER_ID,
  LENDER_ID,
  makeDebt,
  makeUser,
  OUTSIDER_ID,
  type MockPrisma,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createDebt", () => {
  const base = { lenderId: LENDER_ID, borrowerId: BORROWER_ID, amount: 100 };

  it("creates a pending debt with the given fields", async () => {
    db.user.findUnique.mockResolvedValueOnce(makeUser({ id: BORROWER_ID }));
    db.debt.create.mockResolvedValueOnce(
      makeDebt({ lender: makeUser(), borrower: makeUser({ id: BORROWER_ID }) }),
    );

    const debt = await debtService.createDebt({ ...base, description: "Dinner" });

    expect(debt.status).toBe("pending");
    expect(db.debt.create).toHaveBeenCalledWith({
      data: {
        amount: 100,
        description: "Dinner",
        lenderId: LENDER_ID,
        borrowerId: BORROWER_ID,
        groupId: null,
        status: "pending",
      },
      include: expect.anything(),
    });
  });

  it.each([
    [{ ...base, amount: 0 }, "Valid amount is required"],
    [{ ...base, amount: -5 }, "Valid amount is required"],
    [{ ...base, amount: 10, borrowerId: "" }, "Borrower ID is required"],
    [{ ...base, amount: 10, borrowerId: LENDER_ID }, "Cannot create a debt to yourself"],
  ])("rejects invalid input %#", async (params, message) => {
    await expect(debtService.createDebt(params as never)).rejects.toThrow(message);
  });

  it("rejects an unknown borrower", async () => {
    db.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      debtService.createDebt({ ...base, borrowerId: "ghost" }),
    ).rejects.toThrow("Borrower not found");
  });
});

describe("getUserDebts", () => {
  it("defaults to debts where the user is either party", async () => {
    db.debt.findMany.mockResolvedValueOnce([]);
    await debtService.getUserDebts(LENDER_ID);
    expect(db.debt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ lenderId: LENDER_ID }, { borrowerId: LENDER_ID }] },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("applies type and status filters", async () => {
    db.debt.findMany.mockResolvedValueOnce([]);
    await debtService.getUserDebts(LENDER_ID, {
      type: "borrowing",
      status: "pending",
    });
    expect(db.debt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ borrowerId: LENDER_ID }], status: "pending" },
      }),
    );
  });
});

describe("getDebtById", () => {
  it("returns the debt for its lender or borrower", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 7 }));
    expect(await debtService.getDebtById(7, LENDER_ID)).toMatchObject({ id: 7 });

    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 7 }));
    expect(await debtService.getDebtById(7, BORROWER_ID)).toMatchObject({ id: 7 });
  });

  it("rejects outsiders and unknown debts", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 7 }));
    await expect(debtService.getDebtById(7, OUTSIDER_ID)).rejects.toThrow(
      "You don't have permission to view this debt",
    );

    db.debt.findUnique.mockResolvedValueOnce(null);
    await expect(debtService.getDebtById(999, LENDER_ID)).rejects.toThrow(
      "Debt not found",
    );
  });
});

describe("updateDebt", () => {
  it("lets the lender change amount and description", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 7 }));
    db.debt.update.mockResolvedValueOnce(
      makeDebt({ id: 7, amount: 120, description: "Dinner (tip included)" }),
    );

    const debt = await debtService.updateDebt(7, LENDER_ID, { amount: 120 });

    expect(debt.amount).toBe(120);
    expect(db.debt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { amount: 120 } }),
    );
  });

  it("lets the borrower change only status", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 7 }));
    db.debt.update.mockResolvedValueOnce(makeDebt({ id: 7, status: "paid" }));

    await debtService.updateDebt(7, BORROWER_ID, { status: "paid" });

    expect(db.debt.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "paid" } }),
    );
  });

  it("blocks a borrower from changing amount", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 7 }));
    await expect(
      debtService.updateDebt(7, BORROWER_ID, { amount: 50 }),
    ).rejects.toThrow("Only the lender can update amount and description");
  });

  it("rejects outsider, unknown debt and non-positive amounts", async () => {
    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 7 }));
    await expect(
      debtService.updateDebt(7, OUTSIDER_ID, { status: "paid" }),
    ).rejects.toThrow("You don't have permission to update this debt");

    db.debt.findUnique.mockResolvedValueOnce(null);
    await expect(
      debtService.updateDebt(999, LENDER_ID, { status: "paid" }),
    ).rejects.toThrow("Debt not found");

    db.debt.findUnique.mockResolvedValueOnce(makeDebt({ id: 7 }));
    await expect(
      debtService.updateDebt(7, LENDER_ID, { amount: 0 }),
    ).rejects.toThrow("Amount must be positive");
  });
});
