import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/debt-transaction.service", () => ({
  debtTransactionService: {
    createTransaction: vi.fn(),
    respondToTransaction: vi.fn(),
    cancelTransaction: vi.fn(),
  },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { POST } from "@/app/api/debt-transactions/route";
import { DELETE as cancelRoute, PATCH as respondRoute } from "@/app/api/debt-transactions/[id]/route";
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

  it.each([
    ["Debt not found", 404],
    ["You are not authorized to create a transaction for this debt", 403],
    ["Modification must include at least one change (amount or description)", 400],
    ["Proposed amount must be positive", 400],
    ["There is already a pending transaction for this debt", 400],
  ])("keeps %j at %i", async (message, status) => {
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
    vi.mocked(debtTransactionService.createTransaction).mockRejectedValueOnce(new Error(message));

    const res = await POST(postRequest({ debtId: 1, type: "modify" }));

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
  });

  it("answers a generic 500 for any other error, such as an auth outage", async () => {
    vi.mocked(getUser).mockRejectedValueOnce(new TypeError("fetch failed"));

    const res = await POST(postRequest({ debtId: 1, type: "drop" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });

  it("answers 400 for a body that isn't JSON", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);

    const res = await POST(
      new NextRequest("http://localhost/api/debt-transactions", { method: "POST", body: "{oops" }),
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "debtId and type are required" });
    expect(debtTransactionService.createTransaction).not.toHaveBeenCalled();
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

describe("PATCH and DELETE /api/debt-transactions/[id]", () => {
  const url = "http://localhost/api/debt-transactions/7";
  const route = () => ({ params: Promise.resolve({ id: "7" }) });
  const respond = (body: string) =>
    respondRoute(
      new NextRequest(url, { method: "PATCH", body, headers: { "content-type": "application/json" } }),
      route(),
    );
  const cancel = () => cancelRoute(new NextRequest(url, { method: "DELETE" }), route());

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getUser).mockResolvedValue(authUser as never);
  });

  it.each([
    ["Transaction not found", 404],
    ["You are not authorized to respond to this transaction", 403],
    ["This transaction has already been processed", 400],
  ])("PATCH keeps %j at %i", async (message, status) => {
    vi.mocked(debtTransactionService.respondToTransaction).mockRejectedValueOnce(new Error(message));

    const res = await respond(JSON.stringify({ approve: true }));

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
  });

  it.each([
    ["Transaction not found", 404],
    ["Only the requester can cancel this transaction", 403],
    ["This transaction has already been processed", 400],
  ])("DELETE keeps %j at %i", async (message, status) => {
    vi.mocked(debtTransactionService.cancelTransaction).mockRejectedValueOnce(new Error(message));

    const res = await cancel();

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
  });

  it("answers a generic 500 for any other error, such as an auth outage", async () => {
    vi.mocked(getUser).mockRejectedValueOnce(new TypeError("fetch failed"));
    const responded = await respond(JSON.stringify({ approve: true }));
    expect(responded.status).toBe(500);
    expect(await responded.json()).toEqual({ error: "Internal server error" });

    vi.mocked(debtTransactionService.cancelTransaction).mockRejectedValueOnce(
      new Error("Can't reach database server at db.example:5432"),
    );
    const cancelled = await cancel();
    expect(cancelled.status).toBe(500);
    expect(await cancelled.json()).toEqual({ error: "Internal server error" });
  });

  it("PATCH answers 400 for a body that isn't JSON", async () => {
    const res = await respond("{oops");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "approve must be a boolean" });
    expect(debtTransactionService.respondToTransaction).not.toHaveBeenCalled();
  });
});
