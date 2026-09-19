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
import { debtTransactionService } from "@/services/debt-transaction.service";
import {
  BORROWER_ID,
  LENDER_ID,
  MockEmailService,
  MockPrisma,
  makeDebt,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;
const email = emailService as unknown as MockEmailService;

describe("debtTransactionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createTransaction", () => {
    it("throws for a missing debt or a non-party requester", async () => {
      db.debt.findUnique.mockResolvedValueOnce(null);
      await expect(
        debtTransactionService.createTransaction({
          debtId: 1,
          type: "confirm_paid",
          requesterId: LENDER_ID,
        }),
      ).rejects.toThrow("Debt not found");

      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      await expect(
        debtTransactionService.createTransaction({
          debtId: 1,
          type: "confirm_paid",
          requesterId: "user-outsider",
        }),
      ).rejects.toThrow("You are not authorized to create a transaction for this debt");
    });

    it("validates modify requests", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      await expect(
        debtTransactionService.createTransaction({
          debtId: 1,
          type: "modify",
          requesterId: LENDER_ID,
        }),
      ).rejects.toThrow(
        "Modification must include at least one change (amount or description)",
      );

      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      await expect(
        debtTransactionService.createTransaction({
          debtId: 1,
          type: "modify",
          requesterId: LENDER_ID,
          proposedAmount: 0,
        }),
      ).rejects.toThrow("Proposed amount must be positive");
    });

    it("rejects when another pending transaction already exists", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      db.debtTransaction.findFirst.mockResolvedValueOnce({ id: 9 });

      await expect(
        debtTransactionService.createTransaction({
          debtId: 1,
          type: "drop",
          requesterId: LENDER_ID,
        }),
      ).rejects.toThrow("There is already a pending transaction for this debt");
    });

    it("creates the transaction with the requester auto-approved and emails the other party", async () => {
      const debt = {
        ...makeDebt(),
        lender: { id: LENDER_ID, name: "L", email: "l@x.com" },
        borrower: { id: BORROWER_ID, name: "B", email: "b@x.com" },
      };
      db.debt.findUnique.mockResolvedValueOnce(debt);
      db.debtTransaction.findFirst.mockResolvedValueOnce(null);
      const transaction = {
        id: 1,
        type: "drop",
        requesterId: LENDER_ID,
        debt,
        requester: { id: LENDER_ID, name: "L", email: "l@x.com" },
      };
      db.debtTransaction.create.mockResolvedValueOnce(transaction);

      const result = await debtTransactionService.createTransaction({
        debtId: 1,
        type: "drop",
        requesterId: LENDER_ID,
        reason: "Never happened",
      });

      expect(result).toEqual(transaction);
      expect(db.debtTransaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lenderApproved: true,
            borrowerApproved: false,
          }),
        }),
      );
      expect(email.sendDebtModificationRequest).toHaveBeenCalledWith(
        expect.objectContaining({ to: "b@x.com", type: "drop" }),
      );
    });

    it("does not email for confirm_paid", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      db.debtTransaction.findFirst.mockResolvedValueOnce(null);
      db.debtTransaction.create.mockResolvedValueOnce({
        id: 1,
        type: "confirm_paid",
        requesterId: BORROWER_ID,
        debt: makeDebt(),
        requester: { id: BORROWER_ID, name: "B", email: "b@x.com" },
      });

      await debtTransactionService.createTransaction({
        debtId: 1,
        type: "confirm_paid",
        requesterId: BORROWER_ID,
      });

      expect(email.sendDebtModificationRequest).not.toHaveBeenCalled();
    });
  });

  describe("respondToTransaction", () => {
    const pendingTx = {
      id: 1,
      debtId: 1,
      type: "modify",
      status: "pending",
      requesterId: BORROWER_ID,
      lenderApproved: false,
      borrowerApproved: true,
      proposedAmount: 80,
      proposedDescription: null,
      debt: {
        ...makeDebt(),
        lenderId: LENDER_ID,
        borrowerId: BORROWER_ID,
        lender: { id: LENDER_ID, name: "L", email: "l@x.com" },
        borrower: { id: BORROWER_ID, name: "B", email: "b@x.com" },
        group: null,
      },
    };

    it("rejects for missing, processed or foreign transactions", async () => {
      db.debtTransaction.findUnique.mockResolvedValueOnce(null);
      await expect(
        debtTransactionService.respondToTransaction({
          transactionId: 1,
          userId: LENDER_ID,
          approve: true,
        }),
      ).rejects.toThrow("Transaction not found");

      db.debtTransaction.findUnique.mockResolvedValueOnce({
        ...pendingTx,
        status: "approved",
      });
      await expect(
        debtTransactionService.respondToTransaction({
          transactionId: 1,
          userId: LENDER_ID,
          approve: true,
        }),
      ).rejects.toThrow("This transaction has already been processed");

      db.debtTransaction.findUnique.mockResolvedValueOnce(pendingTx);
      await expect(
        debtTransactionService.respondToTransaction({
          transactionId: 1,
          userId: "user-outsider",
          approve: true,
        }),
      ).rejects.toThrow("You are not authorized to respond to this transaction");
    });

    it("rejects without touching the debt", async () => {
      db.debtTransaction.findUnique.mockResolvedValueOnce(pendingTx);
      db.debtTransaction.update.mockResolvedValueOnce({
        ...pendingTx,
        status: "rejected",
        requester: { id: BORROWER_ID, name: "B", email: "b@x.com" },
      });

      const result = await debtTransactionService.respondToTransaction({
        transactionId: 1,
        userId: LENDER_ID,
        approve: false,
      });

      expect(result.debtUpdated).toBe(false);
      expect(db.debtTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "rejected" }) }),
      );
      expect(email.sendDebtRequestRejected).toHaveBeenCalled();
    });

    it("when both parties approve a modify, applies the change to the debt", async () => {
      // requester is the borrower and already approved → lender approving completes it
      db.debtTransaction.findUnique.mockResolvedValueOnce(pendingTx);
      const approvedTx = {
        ...pendingTx,
        status: "approved",
        debt: pendingTx.debt,
        requester: { id: BORROWER_ID, name: "B", email: "b@x.com" },
      };
      const tx = {
        debtTransaction: { update: vi.fn().mockResolvedValue(approvedTx) },
        debt: { update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
        alert: { update: vi.fn() },
      };
      db.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
        fn(tx),
      );

      const result = await debtTransactionService.respondToTransaction({
        transactionId: 1,
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
        expect.objectContaining({ data: { amount: 80 } }),
      );
      expect(email.sendDebtRequestApproved).toHaveBeenCalled();
    });

    it("confirm_paid approval marks the debt paid and deactivates the alert", async () => {
      db.debtTransaction.findUnique.mockResolvedValueOnce({
        ...pendingTx,
        type: "confirm_paid",
      });
      const tx = {
        debtTransaction: { update: vi.fn().mockResolvedValue({ id: 1 }) },
        debt: {
          update: vi
            .fn()
            .mockResolvedValue({ id: 1, status: "paid", alertId: 3, alert: { id: 3 } }),
        },
        alert: { update: vi.fn() },
      };
      db.$transaction.mockImplementationOnce(async (fn: (tx: unknown) => unknown) =>
        fn(tx),
      );

      const result = await debtTransactionService.respondToTransaction({
        transactionId: 1,
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
      expect(email.sendDebtRequestApproved).not.toHaveBeenCalled();
    });

    it("records a single approval without touching the debt when only one party has approved", async () => {
      const tx = {
        id: 1,
        debtId: 1,
        type: "modify",
        status: "pending",
        requesterId: BORROWER_ID,
        lenderApproved: false,
        borrowerApproved: false,
        proposedAmount: 80,
        proposedDescription: null,
        debt: { ...makeDebt(), lenderId: LENDER_ID, borrowerId: BORROWER_ID },
      };
      db.debtTransaction.findUnique.mockResolvedValueOnce(tx);
      db.debtTransaction.update.mockResolvedValueOnce({ ...tx, lenderApproved: true });

      const result = await debtTransactionService.respondToTransaction({
        transactionId: 1,
        userId: LENDER_ID,
        approve: true,
      });

      expect(result.debtUpdated).toBe(false);
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.debtTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { lenderApproved: true } }),
      );
    });
  });

  describe("cancelTransaction", () => {
    it("only the requester can cancel a pending transaction", async () => {
      db.debtTransaction.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: BORROWER_ID,
        status: "pending",
        debt: makeDebt(),
        requester: { id: BORROWER_ID, name: "B", email: "b@x.com" },
      });
      await expect(debtTransactionService.cancelTransaction(1, LENDER_ID)).rejects.toThrow(
        "Only the requester can cancel this transaction",
      );

      db.debtTransaction.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        status: "approved",
        debt: makeDebt(),
        requester: { id: LENDER_ID, name: "L", email: "l@x.com" },
      });
      await expect(debtTransactionService.cancelTransaction(1, LENDER_ID)).rejects.toThrow(
        "This transaction has already been processed",
      );
    });

    it("cancels and emails the other party", async () => {
      const fullDebt = {
        ...makeDebt(),
        lender: { id: LENDER_ID, name: "L", email: "l@x.com" },
        borrower: { id: BORROWER_ID, name: "B", email: "b@x.com" },
      };
      db.debtTransaction.findUnique.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        type: "drop",
        status: "pending",
        debt: fullDebt,
        requester: { id: LENDER_ID, name: "L", email: "l@x.com" },
      });
      db.debtTransaction.update.mockResolvedValueOnce({
        id: 1,
        requesterId: LENDER_ID,
        type: "drop",
        status: "cancelled",
        debt: fullDebt,
        requester: { id: LENDER_ID, name: "L", email: "l@x.com" },
      });

      const cancelled = await debtTransactionService.cancelTransaction(1, LENDER_ID);

      expect(cancelled.status).toBe("cancelled");
      expect(db.debtTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: "cancelled" }) }),
      );
      expect(email.sendDebtRequestCancelled).toHaveBeenCalledWith(
        expect.objectContaining({ to: "b@x.com" }),
      );
    });
  });

  describe("read helpers", () => {
    it("getDebtTransactions requires access to the debt", async () => {
      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      db.debtTransaction.findMany.mockResolvedValueOnce([{ id: 1 }]);

      const txs = await debtTransactionService.getDebtTransactions(1, LENDER_ID);
      expect(txs).toHaveLength(1);

      db.debt.findUnique.mockResolvedValueOnce(makeDebt());
      await expect(
        debtTransactionService.getDebtTransactions(1, "user-outsider"),
      ).rejects.toThrow("You do not have access to this debt");
    });

    it("getPendingCountForUser counts only unapproved pending txs for the user", async () => {
      db.debtTransaction.findMany.mockResolvedValueOnce([
        { lenderApproved: false, borrowerApproved: true, debt: { lenderId: LENDER_ID, borrowerId: BORROWER_ID } },
        { lenderApproved: true, borrowerApproved: true, debt: { lenderId: LENDER_ID, borrowerId: BORROWER_ID } },
        { lenderApproved: true, borrowerApproved: false, debt: { lenderId: LENDER_ID, borrowerId: "u3" } },
      ]);

      const count = await debtTransactionService.getPendingCountForUser(LENDER_ID);

      expect(count).toBe(1);
    });
  });
});
