import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});
vi.mock("@/services/email.service", async () => {
  const { createMockEmailService } = await import("../test/mocks");
  return { emailService: createMockEmailService() };
});

import { prisma } from "@/lib/prisma";
import { emailService } from "@/services/email.service";
import { debtService } from "@/services/debt.service";
import {
  BORROWER_ID,
  LENDER_ID,
  MockEmailService,
  MockPrisma,
  makeDebt,
  makeUser,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;
const email = emailService as unknown as MockEmailService;

describe("debtService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createDebt", () => {
    const base = {
      amount: 50,
      lenderId: LENDER_ID,
      borrowerId: BORROWER_ID,
    };

    it("validates amount, borrower and self-debt", async () => {
      await expect(debtService.createDebt({ ...base, amount: 0 })).rejects.toThrow(
        "Valid amount is required",
      );
      await expect(
        debtService.createDebt({ ...base, borrowerId: "" }),
      ).rejects.toThrow("Borrower ID is required");
      await expect(
        debtService.createDebt({ ...base, borrowerId: LENDER_ID }),
      ).rejects.toThrow("Cannot create a debt to yourself");
      expect(db.debt.create).not.toHaveBeenCalled();
    });

    it("throws when borrower does not exist", async () => {
      db.user.findUnique.mockResolvedValueOnce(null);

      await expect(debtService.createDebt(base)).rejects.toThrow("Borrower not found");
    });

    it("throws when any provided receipt is missing", async () => {
      db.user.findUnique.mockResolvedValueOnce(makeUser({ id: BORROWER_ID }));
      db.receipt.findMany.mockResolvedValueOnce([{ id: "r1" }]);

      await expect(
        debtService.createDebt({ ...base, receiptIds: ["r1", "r2"] }),
      ).rejects.toThrow("One or more receipts not found");
      expect(db.debt.create).not.toHaveBeenCalled();
    });

    it("creates the debt and emails the borrower", async () => {
      const borrower = makeUser({ id: BORROWER_ID, name: "Bob", email: "bob@x.com" });
      db.user.findUnique.mockResolvedValueOnce(borrower);
      const created = {
        ...makeDebt(),
        lender: { id: LENDER_ID, name: "Larry", email: "larry@x.com" },
        borrower: { id: BORROWER_ID, name: "Bob", email: "bob@x.com" },
        group: null,
        receipts: [],
      };
      db.debt.create.mockResolvedValueOnce(created);

      const debt = await debtService.createDebt({ ...base, amount: 20.5 });

      expect(debt).toEqual(created);
      expect(db.debt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            amount: 20.5,
            lenderId: LENDER_ID,
            borrowerId: BORROWER_ID,
            status: "pending",
          }),
        }),
      );
      expect(email.sendDebtCreated).toHaveBeenCalledWith(
        expect.objectContaining({ to: "bob@x.com", amount: 100 }),
      );
    });

    it("connects receipts when provided", async () => {
      db.user.findUnique.mockResolvedValueOnce(makeUser({ id: BORROWER_ID }));
      db.receipt.findMany.mockResolvedValueOnce([{ id: "r1" }]);
      db.debt.create.mockResolvedValueOnce({
        ...makeDebt(),
        lender: { id: LENDER_ID, name: "L", email: "l@x.com" },
        borrower: { id: BORROWER_ID, name: "B", email: "b@x.com" },
        group: null,
        receipts: [],
      });

      await debtService.createDebt({ ...base, receiptIds: ["r1"] });

      expect(db.debt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            receipts: { connect: [{ id: "r1" }] },
          }),
        }),
      );
    });
  });

  describe("getUserDebts", () => {
    it("scopes the where clause by type and status filters", async () => {
      db.debt.findMany.mockResolvedValueOnce([]);

      await debtService.getUserDebts(LENDER_ID, { type: "lending", status: "pending" });

      expect(db.debt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ lenderId: LENDER_ID }], status: "pending" },
        }),
      );
    });

    it("defaults to both lending and borrowing", async () => {
      db.debt.findMany.mockResolvedValueOnce([]);

      await debtService.getUserDebts(LENDER_ID);

      expect(db.debt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ lenderId: LENDER_ID }, { borrowerId: LENDER_ID }] },
        }),
      );
    });
  });

  describe("getGroupDebts", () => {
    it("requires membership in the group", async () => {
      db.groupMember.findUnique.mockResolvedValueOnce(null);

      await expect(debtService.getGroupDebts(1, LENDER_ID)).rejects.toThrow(
        "You must be a member of the group to view its debts",
      );
      expect(db.debt.findMany).not.toHaveBeenCalled();
    });

    it("returns debts scoped to the group for members", async () => {
      db.groupMember.findUnique.mockResolvedValueOnce({ id: 1 });
      db.debt.findMany.mockResolvedValueOnce([{ ...makeDebt(), groupId: 1 }]);

      const debts = await debtService.getGroupDebts(1, LENDER_ID);

      expect(debts).toHaveLength(1);
      expect(db.debt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { groupId: 1 } }),
      );
    });
  });

  describe("getDebtById", () => {
    it("throws when the debt does not exist", async () => {
      db.debt.findUnique.mockResolvedValueOnce(null);

      await expect(debtService.getDebtById(999, LENDER_ID)).rejects.toThrow(
        "Debt not found",
      );
    });

    it("throws for non-parties (policy check)", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());

      await expect(debtService.getDebtById(1, "user-outsider")).rejects.toThrow(
        "You don't have permission to view this debt",
      );
    });

    it("returns the debt for either party", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());

      expect(await debtService.getDebtById(1, BORROWER_ID)).toBeTruthy();
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      expect(await debtService.getDebtById(1, LENDER_ID)).toBeTruthy();
    });
  });

  describe("updateDebt", () => {
    it("rejects users who are not part of the debt", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());

      await expect(
        debtService.updateDebt(1, "user-outsider", { status: "paid" }),
      ).rejects.toThrow("You don't have permission to update this debt");
    });

    it("only lets the lender change amount/description", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());

      await expect(
        debtService.updateDebt(1, BORROWER_ID, { amount: 5 }),
      ).rejects.toThrow("Only the lender can update amount and description");
    });

    it("rejects non-positive amounts", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());

      await expect(
        debtService.updateDebt(1, LENDER_ID, { amount: 0 }),
      ).rejects.toThrow("Amount must be positive");
    });

    it("lets the lender update the amount", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      db.debt.update.mockResolvedValueOnce(makeDebt({ amount: 75 }));

      const debt = await debtService.updateDebt(1, LENDER_ID, { amount: 75 });

      expect(debt.amount).toBe(75);
      expect(db.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { amount: 75 } }),
      );
    });

    it("lets the borrower change only the status", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      db.debt.update.mockResolvedValueOnce(makeDebt({ status: "paid" }));

      await debtService.updateDebt(1, BORROWER_ID, { status: "paid" });

      expect(db.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "paid" } }),
      );
    });
  });

  describe("deleteDebt", () => {
    it("rejects non-lenders", async () => {
      db.debt.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });

      await expect(debtService.deleteDebt(1, BORROWER_ID)).rejects.toThrow(
        "Only the lender can delete this debt",
      );
    });

    it("rejects when debt vanished after the permission check", async () => {
      db.debt.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });
      db.debt.findUnique.mockResolvedValueOnce(null);

      await expect(debtService.deleteDebt(1, LENDER_ID)).rejects.toThrow(
        "Debt not found",
      );
    });

    it("deactivates the alert and deletes the debt in a transaction, then emails both parties", async () => {
      const debt = {
        ...makeDebt({ alertId: 7 }),
        lender: { id: LENDER_ID, name: "L", email: "l@x.com" },
        borrower: { id: BORROWER_ID, name: "B", email: "b@x.com" },
        group: null,
      };
      db.debt.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });
      db.debt.findUnique.mockResolvedValueOnce(debt);

      const tx = { alert: { update: vi.fn() }, debt: { delete: vi.fn() } };
      db.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
        await fn(tx);
      });

      await debtService.deleteDebt(1, LENDER_ID);

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.alert.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
      expect(tx.debt.delete).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(email.sendDebtDeleted).toHaveBeenCalledTimes(2);
      expect(email.sendDebtDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ to: "l@x.com", deletedBy: "You" }),
      );
      expect(email.sendDebtDeleted).toHaveBeenCalledWith(
        expect.objectContaining({ to: "b@x.com", deletedBy: "L" }),
      );
    });

    it("skips the alert update when the debt has no alert", async () => {
      const debt = {
        ...makeDebt({ alertId: null }),
        lender: { id: LENDER_ID, name: "L", email: "l@x.com" },
        borrower: { id: BORROWER_ID, name: "B", email: "b@x.com" },
        group: null,
      };
      db.debt.findUnique.mockResolvedValueOnce({ lenderId: LENDER_ID });
      db.debt.findUnique.mockResolvedValueOnce(debt);

      const tx = { alert: { update: vi.fn() }, debt: { delete: vi.fn() } };
      db.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) => {
        await fn(tx);
      });

      await debtService.deleteDebt(1, LENDER_ID);

      expect(tx.alert.update).not.toHaveBeenCalled();
      expect(tx.debt.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });
});
