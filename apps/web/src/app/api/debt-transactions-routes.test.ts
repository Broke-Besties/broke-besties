import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/debt-transaction.service", () => ({
  debtTransactionService: { createTransaction: vi.fn() },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { POST } from "@/app/api/debt-transactions/route";
import { LENDER_ID } from "../../test/mocks";

const authUser = { id: LENDER_ID, email: "larry@x.com" };

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/debt-transactions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/debt-transactions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null);

    const res = await POST(postRequest({ debtId: 1, type: "confirm_paid" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(debtTransactionService.createTransaction).not.toHaveBeenCalled();
  });

  it("creates the request and returns 201", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
    vi.mocked(debtTransactionService.createTransaction).mockResolvedValueOnce({
      id: 9,
    } as never);

    const res = await POST(
      postRequest({ debtId: 1, type: "modify", proposedAmount: 12, reason: "typo" }),
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ transaction: { id: 9 } });
    expect(debtTransactionService.createTransaction).toHaveBeenCalledWith({
      debtId: 1,
      type: "modify",
      requesterId: LENDER_ID,
      proposedAmount: 12,
      proposedDescription: undefined,
      reason: "typo",
    });
  });

  it("maps 'Debt not found' to 404", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
    vi.mocked(debtTransactionService.createTransaction).mockRejectedValueOnce(
      new Error("Debt not found"),
    );

    const res = await POST(postRequest({ debtId: 404, type: "drop" }));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Debt not found" });
  });

  it("keeps 403 for authorization errors and 400 for everything else", async () => {
    vi.mocked(getUser).mockResolvedValue(authUser as never);

    vi.mocked(debtTransactionService.createTransaction).mockRejectedValueOnce(
      new Error("You are not authorized to create a transaction for this debt"),
    );
    let res = await POST(postRequest({ debtId: 1, type: "drop" }));
    expect(res.status).toBe(403);

    vi.mocked(debtTransactionService.createTransaction).mockRejectedValueOnce(
      new Error("There is already a pending transaction for this debt"),
    );
    res = await POST(postRequest({ debtId: 1, type: "drop" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "There is already a pending transaction for this debt",
    });
  });

  it("still validates debtId and type before calling the service", async () => {
    vi.mocked(getUser).mockResolvedValue(authUser as never);

    let res = await POST(postRequest({ type: "drop" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "debtId and type are required" });

    res = await POST(postRequest({ debtId: 1, type: "weird" }));
    expect(res.status).toBe(400);
    expect(debtTransactionService.createTransaction).not.toHaveBeenCalled();
  });
});
