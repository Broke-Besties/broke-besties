import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/services/recurring-payment.service", () => ({
  recurringPaymentService: {
    resolveBorrowerInputs: vi.fn(),
    createRecurringPayment: vi.fn(),
  },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { recurringPaymentService } from "@/services/recurring-payment.service";
import { POST } from "@/app/api/recurring-payments/route";
import { LENDER_ID } from "../../test/mocks";

const authUser = { id: LENDER_ID, email: "larry@x.com" };
const body = {
  amount: 30,
  description: "Netflix",
  frequency: 30,
  borrowers: [{ email: "bob@x.com", splitPercentage: 100 }],
};

function postRequest(payload: unknown) {
  return new NextRequest("http://localhost/api/recurring-payments", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/recurring-payments", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null);

    const res = await POST(postRequest(body));

    expect(res.status).toBe(401);
    expect(recurringPaymentService.createRecurringPayment).not.toHaveBeenCalled();
  });

  it("resolves borrower emails before creating the payment", async () => {
    const resolved = [{ userId: "user-bob", splitPercentage: 100 }];
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
    vi.mocked(recurringPaymentService.resolveBorrowerInputs).mockResolvedValueOnce(resolved);
    vi.mocked(recurringPaymentService.createRecurringPayment).mockResolvedValueOnce({
      id: 1,
    } as never);

    const res = await POST(postRequest(body));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      message: "Recurring payment created successfully",
      recurringPayment: { id: 1 },
    });
    expect(recurringPaymentService.resolveBorrowerInputs).toHaveBeenCalledWith(body.borrowers);
    expect(recurringPaymentService.createRecurringPayment).toHaveBeenCalledWith({
      amount: 30,
      description: "Netflix",
      frequency: 30,
      lenderId: LENDER_ID,
      borrowers: resolved,
    });
  });

  it.each([
    ["Each borrower needs an email or userId", 400],
    ["At least one borrower is required", 400],
    ["User with email bob@x.com not found", 404],
  ])("maps the borrower error %j to %i", async (message, status) => {
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
    vi.mocked(recurringPaymentService.resolveBorrowerInputs).mockRejectedValueOnce(
      new Error(message),
    );

    const res = await POST(postRequest(body));

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: message });
    expect(recurringPaymentService.createRecurringPayment).not.toHaveBeenCalled();
  });

  it("keeps the service's existing 400 mapping", async () => {
    vi.mocked(getUser).mockResolvedValueOnce(authUser as never);
    vi.mocked(recurringPaymentService.resolveBorrowerInputs).mockResolvedValueOnce([]);
    vi.mocked(recurringPaymentService.createRecurringPayment).mockRejectedValueOnce(
      new Error("Split percentages must sum to 100%"),
    );

    const res = await POST(postRequest(body));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Split percentages must sum to 100%" });
  });
});
