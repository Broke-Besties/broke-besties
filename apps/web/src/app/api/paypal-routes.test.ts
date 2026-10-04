import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
// Not importOriginal: the real service imports the email service, which
// throws at import time without RESEND_API_KEY.
vi.mock("@/services/paypal.service", () => ({
  paypalService: {
    buildConnectUrl: vi.fn(),
    handleOAuthCallback: vi.fn(),
    getAccount: vi.fn(),
    disconnect: vi.fn(),
    createDebtOrder: vi.fn(),
    capturePayment: vi.fn(),
    getReturnRedirect: vi.fn(),
  },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { PaypalConfigError, PaypalFlowError } from "@/lib/paypal-errors";
import { paypalService } from "@/services/paypal.service";
import { GET as connectRoute } from "@/app/api/paypal/connect/route";
import { GET as callbackRoute } from "@/app/api/paypal/callback/route";
import { DELETE as disconnectRoute, GET as getAccountRoute } from "@/app/api/paypal/account/route";
import { POST as createOrderRoute } from "@/app/api/debts/[id]/paypal/order/route";
import { POST as captureRoute } from "@/app/api/paypal/payments/[id]/capture/route";
import { GET as returnRoute } from "@/app/paypal/return/route";
import { BORROWER_ID, LENDER_ID } from "../../test/mocks";

function signIn(id = BORROWER_ID) {
  vi.mocked(getUser).mockResolvedValue({ id } as never);
}

function signOut() {
  vi.mocked(getUser).mockResolvedValue(null);
}

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  vi.resetAllMocks();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("GET /api/paypal/connect", () => {
  const url = "https://www.sandbox.paypal.com/signin/authorize?state=abc.def";

  it("returns 401 when unauthenticated", async () => {
    signOut();

    const res = await connectRoute(
      new NextRequest("http://localhost/api/paypal/connect?platform=ios"),
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
    expect(paypalService.buildConnectUrl).not.toHaveBeenCalled();
  });

  it("returns the authorize URL for the iOS app and its variant", async () => {
    signIn();
    vi.mocked(paypalService.buildConnectUrl).mockReturnValue(url);

    const res = await connectRoute(
      new NextRequest("http://localhost/api/paypal/connect?platform=ios", {
        headers: { "X-App-Variant": "preview" },
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url });
    expect(paypalService.buildConnectUrl).toHaveBeenCalledWith({
      userId: BORROWER_ID,
      platform: "ios",
      appVariant: "preview",
    });
  });

  it.each(["", "?platform=web", "?platform=IOS"])("uses the web flow for %j", async (query) => {
    signIn();
    vi.mocked(paypalService.buildConnectUrl).mockReturnValue(url);

    await connectRoute(new NextRequest(`http://localhost/api/paypal/connect${query}`));

    expect(paypalService.buildConnectUrl).toHaveBeenCalledWith({
      userId: BORROWER_ID,
      platform: "web",
      appVariant: null,
    });
  });

  it("answers 503 when PayPal is not configured", async () => {
    signIn();
    vi.mocked(paypalService.buildConnectUrl).mockImplementation(() => {
      throw new PaypalConfigError("PAYPAL_CLIENT_ID is not set");
    });

    const res = await connectRoute(new NextRequest("http://localhost/api/paypal/connect"));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "PayPal is not configured" });
    expect(consoleError).toHaveBeenCalled();
  });

  it("answers 500 without leaking an unexpected error", async () => {
    signIn();
    vi.mocked(paypalService.buildConnectUrl).mockImplementation(() => {
      throw new Error("state secret abc123 rejected");
    });

    const res = await connectRoute(new NextRequest("http://localhost/api/paypal/connect"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
    expect(consoleError).toHaveBeenCalled();
  });
});

describe("GET /api/paypal/callback (public)", () => {
  it("hands PayPal's query to the service without a session", async () => {
    vi.mocked(paypalService.handleOAuthCallback).mockResolvedValue(
      "https://brokebesties.app/profile?paypal=connected",
    );

    await callbackRoute(
      new NextRequest("https://brokebesties.app/api/paypal/callback?code=AUTH-1&state=eyJ1.c2ln"),
    );
    await callbackRoute(
      new NextRequest("https://brokebesties.app/api/paypal/callback?error=access_denied"),
    );

    expect(paypalService.handleOAuthCallback).toHaveBeenNthCalledWith(1, {
      code: "AUTH-1",
      state: "eyJ1.c2ln",
      error: null,
    });
    expect(paypalService.handleOAuthCallback).toHaveBeenNthCalledWith(2, {
      code: null,
      state: null,
      error: "access_denied",
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each([
    [
      "https://brokebesties.app/profile?paypal=connected",
      "https://brokebesties.app/profile?paypal=connected",
    ],
    [
      "brokebesties-dev://paypal/connected?status=error&reason=in_use",
      "brokebesties-dev://paypal/connected?status=error&reason=in_use",
    ],
    [
      "/profile?paypal=error&reason=config",
      "https://brokebesties.app/profile?paypal=error&reason=config",
    ],
  ])("302s to %s", async (target, location) => {
    vi.mocked(paypalService.handleOAuthCallback).mockResolvedValue(target);

    const res = await callbackRoute(
      new NextRequest("https://brokebesties.app/api/paypal/callback?code=c&state=s"),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(location);
  });
});

describe("GET /api/paypal/account", () => {
  it("returns 401 when unauthenticated", async () => {
    signOut();

    const res = await getAccountRoute();

    expect(res.status).toBe(401);
    expect(paypalService.getAccount).not.toHaveBeenCalled();
  });

  it("returns the user's linked account, or null", async () => {
    signIn();
    vi.mocked(paypalService.getAccount)
      .mockResolvedValueOnce({
        email: "bob@paypal.example",
        emailVerified: true,
        connectedAt: new Date("2026-10-01T12:00:00.000Z"),
      })
      .mockResolvedValueOnce(null);

    const linked = await getAccountRoute();
    const unlinked = await getAccountRoute();

    expect(await linked.json()).toEqual({
      account: {
        email: "bob@paypal.example",
        emailVerified: true,
        connectedAt: "2026-10-01T12:00:00.000Z",
      },
    });
    expect(await unlinked.json()).toEqual({ account: null });
    expect(paypalService.getAccount).toHaveBeenCalledWith(BORROWER_ID);
  });
});

describe("DELETE /api/paypal/account", () => {
  it("returns 401 when unauthenticated", async () => {
    signOut();

    const res = await disconnectRoute();

    expect(res.status).toBe(401);
    expect(paypalService.disconnect).not.toHaveBeenCalled();
  });

  it("unlinks the user's account", async () => {
    signIn();

    const res = await disconnectRoute();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "PayPal disconnected" });
    expect(paypalService.disconnect).toHaveBeenCalledWith(BORROWER_ID);
  });
});

describe("POST /api/debts/[id]/paypal/order", () => {
  const order = {
    paymentId: "pay_1",
    approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=O-1",
  };
  let now = Date.UTC(2026, 9, 4);

  function createOrder(id: string, init: { body?: string; headers?: Record<string, string> } = {}) {
    return createOrderRoute(
      new NextRequest(`http://localhost/api/debts/${id}/paypal/order`, { method: "POST", ...init }),
      { params: Promise.resolve({ id }) },
    );
  }

  beforeEach(() => {
    // The limiter lives in the route module: start every test in a fresh window.
    now += 10 * 60_000;
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 401 when unauthenticated", async () => {
    signOut();

    const res = await createOrder("42");

    expect(res.status).toBe(401);
    expect(paypalService.createDebtOrder).not.toHaveBeenCalled();
  });

  it.each(["abc", "1.5", "12abc", "0", "-3", "99999999999", "1e2", "0x10", "+5", "5.0", " 7 "])(
    "returns 400 for debt id %j",
    async (id) => {
      signIn();

      const res = await createOrder(id);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "Invalid debt ID" });
      expect(paypalService.createDebtOrder).not.toHaveBeenCalled();
    },
  );

  it("creates an order for the iOS app and answers 201", async () => {
    signIn();
    vi.mocked(paypalService.createDebtOrder).mockResolvedValue(order);

    const res = await createOrder("42", {
      body: JSON.stringify({ platform: "ios" }),
      headers: { "content-type": "application/json", "X-App-Variant": "development" },
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(order);
    expect(paypalService.createDebtOrder).toHaveBeenCalledWith({
      debtId: 42,
      userId: BORROWER_ID,
      platform: "ios",
      appVariant: "development",
    });
  });

  it.each([
    ["no body", undefined],
    ["invalid JSON", "{platform:"],
    ["platform web", JSON.stringify({ platform: "web" })],
    ["a JSON string", JSON.stringify("ios")],
    ["null", "null"],
  ])("uses web for %s", async (_label, body) => {
    signIn();
    vi.mocked(paypalService.createDebtOrder).mockResolvedValue(order);

    const res = await createOrder("42", { body });

    expect(res.status).toBe(201);
    expect(paypalService.createDebtOrder).toHaveBeenCalledWith({
      debtId: 42,
      userId: BORROWER_ID,
      platform: "web",
      appVariant: null,
    });
  });

  const inProgress = "A PayPal payment is already in progress for this debt";
  const resume = {
    paymentId: "pay_0",
    approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=O-0",
  };
  it.each([
    [new PaypalFlowError(409, inProgress, resume), 409, { error: inProgress, ...resume }],
    [
      new PaypalFlowError(403, "Only the borrower can pay this debt with PayPal"),
      403,
      { error: "Only the borrower can pay this debt with PayPal" },
    ],
    [
      new PaypalConfigError("PAYPAL_CLIENT_SECRET is not set"),
      503,
      { error: "PayPal is not configured" },
    ],
    [
      new Error("password authentication failed for user postgres"),
      500,
      { error: "Internal server error" },
    ],
  ])("maps %s to %i", async (error, status, body) => {
    signIn();
    vi.mocked(paypalService.createDebtOrder).mockRejectedValue(error);

    const res = await createOrder("42");

    expect(res.status).toBe(status);
    expect(await res.json()).toEqual(body);
  });

  it("allows 5 orders per user per minute, then answers 429 with Retry-After", async () => {
    vi.mocked(paypalService.createDebtOrder).mockResolvedValue(order);
    signIn();
    for (let i = 0; i < 5; i++) expect((await createOrder("42")).status).toBe(201);

    const limited = await createOrder("42");

    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(await limited.json()).toEqual({
      error: "Too many PayPal requests. Try again in a minute.",
    });
    expect(paypalService.createDebtOrder).toHaveBeenCalledTimes(5);

    signIn(LENDER_ID);
    expect((await createOrder("42")).status).toBe(201);

    signIn();
    vi.setSystemTime(now + 60_000);
    expect((await createOrder("42")).status).toBe(201);
  });
});

describe("POST /api/paypal/payments/[id]/capture", () => {
  const payment = {
    id: "pay_1",
    status: "COMPLETED" as const,
    amountCents: 4250,
    createdAt: new Date("2026-10-04T10:00:00.000Z"),
    completedAt: new Date("2026-10-04T10:01:00.000Z"),
  };
  const paymentJson = {
    ...payment,
    createdAt: "2026-10-04T10:00:00.000Z",
    completedAt: "2026-10-04T10:01:00.000Z",
  };

  function capture() {
    return captureRoute(
      new NextRequest("http://localhost/api/paypal/payments/pay_1/capture", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ id: "pay_1" }) },
    );
  }

  it("returns 401 when unauthenticated", async () => {
    signOut();

    const res = await capture();

    expect(res.status).toBe(401);
    expect(paypalService.capturePayment).not.toHaveBeenCalled();
  });

  it("answers 200 with the payment and the paid debt", async () => {
    signIn();
    vi.mocked(paypalService.capturePayment).mockResolvedValue({
      httpStatus: 200,
      payment,
      debt: { id: 42, status: "paid" } as never,
    });

    const res = await capture();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ payment: paymentJson, debt: { id: 42, status: "paid" } });
    expect(paypalService.capturePayment).toHaveBeenCalledWith("pay_1", BORROWER_ID);
  });

  it("answers 202 with just the payment while PayPal is processing", async () => {
    signIn();
    vi.mocked(paypalService.capturePayment).mockResolvedValue({
      httpStatus: 202,
      payment: { ...payment, status: "APPROVED", completedAt: null },
    });

    const res = await capture();

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({
      payment: { ...paymentJson, status: "APPROVED", completedAt: null },
    });
  });

  it("passes a 402 decline through", async () => {
    signIn();
    const declined = "PayPal declined the payment method. Try again with a different one.";
    vi.mocked(paypalService.capturePayment).mockRejectedValue(new PaypalFlowError(402, declined));

    const res = await capture();

    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: declined });
  });
});

describe("GET /paypal/return (public)", () => {
  it("hands pp, token and cancelled=1 to the service without a session", async () => {
    vi.mocked(paypalService.getReturnRedirect).mockResolvedValue("https://brokebesties.app/debts");

    await returnRoute(
      new NextRequest(
        "https://brokebesties.app/paypal/return?pp=pay_1&platform=web&token=O-1&PayerID=P1",
      ),
    );
    await returnRoute(
      new NextRequest("https://brokebesties.app/paypal/return?pp=pay_1&platform=ios&cancelled=1"),
    );
    await returnRoute(new NextRequest("https://brokebesties.app/paypal/return?cancelled=true"));

    expect(paypalService.getReturnRedirect).toHaveBeenNthCalledWith(1, {
      paymentId: "pay_1",
      orderToken: "O-1",
      cancelled: false,
    });
    expect(paypalService.getReturnRedirect).toHaveBeenNthCalledWith(2, {
      paymentId: "pay_1",
      orderToken: null,
      cancelled: true,
    });
    expect(paypalService.getReturnRedirect).toHaveBeenNthCalledWith(3, {
      paymentId: null,
      orderToken: null,
      cancelled: false,
    });
    expect(getUser).not.toHaveBeenCalled();
  });

  it.each([
    [
      "https://brokebesties.app/debts/42?paypal=approved&pp=pay_1",
      "https://brokebesties.app/debts/42?paypal=approved&pp=pay_1",
    ],
    [
      "brokebesties://paypal/return?pp=pay_1&status=approved",
      "brokebesties://paypal/return?pp=pay_1&status=approved",
    ],
    ["/debts?paypal=error", "https://brokebesties.app/debts?paypal=error"],
  ])("302s to %s", async (target, location) => {
    vi.mocked(paypalService.getReturnRedirect).mockResolvedValue(target);

    const res = await returnRoute(
      new NextRequest("https://brokebesties.app/paypal/return?pp=pay_1&token=O-1"),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(location);
  });
});

describe("paypalErrorResponse", () => {
  it("always answers { error: message }, even if a flow error's body has an error key", async () => {
    const { paypalErrorResponse } = await import("@/lib/paypal-http");

    const res = paypalErrorResponse(new PaypalFlowError(409, "Busy", { error: "spoofed", paymentId: "p1" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Busy", paymentId: "p1" });
  });
});
