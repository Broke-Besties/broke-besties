import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/debt.service", () => ({ debtService: { getDebtById: vi.fn() } }));
vi.mock("@/services/debt-transaction.service", () => ({
  debtTransactionService: { getDebtTransactions: vi.fn() },
}));
vi.mock("@/services/receipt.service", () => ({ receiptService: { getSignedImageUrls: vi.fn() } }));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { receiptService } from "@/services/receipt.service";
import { GET as getDebtRoute } from "@/app/api/debts/[id]/route";
import { BORROWER_ID, makeDebt } from "../../test/mocks";

const debt = makeDebt({ receipts: [{ id: "rcpt_1" }, { id: "rcpt_2" }], alert: null });

function getDebt() {
  return getDebtRoute(new NextRequest("http://localhost/api/debts/1"), {
    params: Promise.resolve({ id: "1" }),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(getUser).mockResolvedValue({ id: BORROWER_ID } as never);
});

describe("GET /api/debts/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUser).mockResolvedValue(null);

    const res = await getDebt();

    expect(res.status).toBe(401);
    expect(debtService.getDebtById).not.toHaveBeenCalled();
  });

  it("returns the debt with its transactions, and receipt image URLs", async () => {
    const transactions = [{ id: 7, status: "approved" }];
    const receiptImageUrls = [{ id: "rcpt_1", url: "https://storage.example/rcpt_1?token=t" }];
    vi.mocked(debtService.getDebtById).mockResolvedValue(debt as never);
    vi.mocked(debtTransactionService.getDebtTransactions).mockResolvedValue(transactions as never);
    vi.mocked(receiptService.getSignedImageUrls).mockResolvedValue(receiptImageUrls);

    const res = await getDebt();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(
      JSON.parse(JSON.stringify({ debt, transactions, receiptImageUrls })),
    );
    expect(debtService.getDebtById).toHaveBeenCalledWith(1, BORROWER_ID);
    expect(debtTransactionService.getDebtTransactions).toHaveBeenCalledWith(1, BORROWER_ID);
    expect(receiptService.getSignedImageUrls).toHaveBeenCalledWith(["rcpt_1", "rcpt_2"]);
  });

  it.each([
    ["Debt not found", 404],
    ["You don't have permission to view this debt", 403],
  ])("maps %j to %i", async (message, status) => {
    vi.mocked(debtService.getDebtById).mockRejectedValue(new Error(message));

    const res = await getDebt();

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
    expect(debtTransactionService.getDebtTransactions).not.toHaveBeenCalled();
  });

  it("answers 500 without leaking an unexpected error", async () => {
    vi.mocked(debtService.getDebtById).mockResolvedValue(debt as never);
    vi.mocked(debtTransactionService.getDebtTransactions).mockResolvedValue([] as never);
    vi.mocked(receiptService.getSignedImageUrls).mockRejectedValue(
      new Error("Can't reach database server at db.internal:5432"),
    );

    const res = await getDebt();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });
});
