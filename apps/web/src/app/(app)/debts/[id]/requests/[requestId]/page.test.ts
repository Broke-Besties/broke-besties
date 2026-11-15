import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import RequestDetailPage from "./page";

const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getTransaction: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ getUser: mocks.getUser }));
vi.mock("@/services/debt-transaction.service", () => ({
  debtTransactionService: { getTransactionById: mocks.getTransaction },
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@/app/(app)/groups/[id]/actions", () => ({
  respondToDebtTransaction: vi.fn(),
  cancelDebtTransaction: vi.fn(),
}));
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

function request(status = "pending") {
  const lender = { id: "me", name: "Daniel", email: "me@example.com" };
  const borrower = { id: "friend", name: "Alex", email: "alex@example.com" };
  return {
    id: 456,
    debtId: 123,
    type: "modify",
    status,
    lenderApproved: status === "approved",
    borrowerApproved: true,
    proposedAmount: 15,
    proposedDescription: "Discounted dinner",
    reason: "Discount applied",
    createdAt: "2026-11-14T12:00:00Z",
    resolvedAt: status === "pending" ? null : "2026-11-15T12:00:00Z",
    requester: borrower,
    debt: {
      id: 123,
      amount: 20,
      description: "Dinner",
      status: "pending",
      createdAt: "2026-11-14T12:00:00Z",
      lenderId: "me",
      borrowerId: "friend",
      lender,
      borrower,
      group: null,
    },
  };
}
const page = (id = "123", requestId = "456") =>
  RequestDetailPage({ params: Promise.resolve({ id, requestId }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue({ id: "me" });
  mocks.getTransaction.mockResolvedValue(request());
});

describe("request review route", () => {
  it("loads the specific request with participant access checks and existing controls", async () => {
    const html = renderToStaticMarkup(await page());
    expect(mocks.getTransaction).toHaveBeenCalledWith(456, "me");
    expect(html).toContain("Discount applied");
    expect(html).toContain('href="/debts/123"');
    expect(html).toContain(">Accept changes</button>");
    expect(html).toContain(">Decline request</button>");
  });
  it.each(["approved", "rejected", "cancelled"])(
    "keeps %s requests readable without response controls",
    async (status) => {
      mocks.getTransaction.mockResolvedValue(request(status));
      const html = renderToStaticMarkup(await page());
      expect(html).toContain("Discount applied");
      expect(html).toContain("Resolved on");
      expect(html).toContain("Requested amount");
      expect(html).not.toContain(">Accept changes</button>");
      expect(html).not.toContain(">Decline request</button>");
      expect(html).not.toContain("Cancel request");
      expect(html).not.toContain("Waiting for");
    },
  );
  it("explains payment confirmation and uses an explicit action", async () => {
    const transaction = request();
    transaction.type = "confirm_paid";
    mocks.getTransaction.mockResolvedValue(transaction);
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Has the $20.00 debt been paid?");
    expect(html).toContain("Alex borrowed $20.00 from you.");
    expect(html).toContain("does not transfer money");
    expect(html).toContain(">Mark as paid</button>");
    expect(html).toContain("Needs your review");
  });
  it("explains permanent deletion before the destructive action", async () => {
    const transaction = request();
    transaction.type = "drop";
    mocks.getTransaction.mockResolvedValue(transaction);
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("Delete the $20.00 debt?");
    expect(html).toContain("Deleting is permanent");
    expect(html).toContain("debt and its request history");
    expect(html).toContain(">Delete debt</button>");
    expect(html).toContain("bg-destructive");
  });
  it("describes the relationship correctly for the borrower", async () => {
    mocks.getUser.mockResolvedValue({ id: "friend" });
    const html = renderToStaticMarkup(await page());
    expect(html).toContain("You borrowed $20.00 from Daniel.");
    expect(html).toContain("Your reason");
    expect(html).toContain("Waiting on the other person");
    expect(html).not.toContain(">Accept changes</button>");
  });
  it("rejects a request under the wrong debt URL", async () => {
    await expect(page("999")).rejects.toThrow("NOT_FOUND");
  });
  it.each(["123abc", "1.5", "2147483648", "Infinity"])(
    "rejects malformed ID %s before querying",
    async (id) => {
      await expect(page(id)).rejects.toThrow("NOT_FOUND");
      await expect(page("123", id)).rejects.toThrow("NOT_FOUND");
      expect(mocks.getTransaction).not.toHaveBeenCalled();
    },
  );
  it("accepts the negative IDs used by local demo records", async () => {
    const transaction = request();
    transaction.id = -456;
    transaction.debtId = -123;
    transaction.debt.id = -123;
    mocks.getTransaction.mockResolvedValue(transaction);
    await page("-123", "-456");
    expect(mocks.getTransaction).toHaveBeenCalledWith(-456, "me");
  });
  it("does not reveal missing or unauthorized requests", async () => {
    mocks.getTransaction.mockRejectedValue(
      new Error("You do not have access to this transaction"),
    );
    await expect(page()).rejects.toThrow("NOT_FOUND");
  });
  it("redirects signed-out visitors before loading a request", async () => {
    mocks.getUser.mockResolvedValue(null);
    await expect(page()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.getTransaction).not.toHaveBeenCalled();
  });
});
