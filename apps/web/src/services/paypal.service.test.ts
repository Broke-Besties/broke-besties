import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { paypalService } from "@/services/paypal.service";
import { resetPaypalTokenCacheForTests, signState, verifyState } from "@/lib/paypal";
import { PaypalConfigError } from "@/lib/paypal-errors";
import {
  BORROWER_ID,
  LENDER_ID,
  OUTSIDER_ID,
  makeDebt,
  type MockEmailService,
  type MockPrisma,
} from "../test/mocks";

const db = prisma as unknown as MockPrisma;
const email = emailService as unknown as MockEmailService;

// --- fake PayPal REST API --------------------------------------------------------------------

type PaypalCall = { method: string; path: string; headers: Headers; body?: string };
let paypalRequests: PaypalCall[];
let paypalRoutes: Map<string, (Response | Error)[]>;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Queue responses (or thrown errors) for `METHOD /path`; the app token is answered by default. */
function onPaypal(method: string, path: string, ...responses: (Response | Error)[]) {
  const key = `${method} ${path}`;
  paypalRoutes.set(key, [...(paypalRoutes.get(key) ?? []), ...responses]);
}

function paypalCalls(method: string, path: string) {
  return paypalRequests.filter((call) => call.method === method && call.path === path);
}

async function fakePaypalFetch(input: string, init: RequestInit = {}) {
  const url = new URL(input);
  const method = init.method ?? "GET";
  paypalRequests.push({
    method,
    path: url.pathname,
    headers: new Headers(init.headers),
    body: init.body as string | undefined,
  });
  const next = paypalRoutes.get(`${method} ${url.pathname}`)?.shift();
  if (next instanceof Error) throw next;
  if (next) return next;
  if (url.pathname === "/v1/oauth2/token") {
    return json(200, { access_token: "app-token", expires_in: 32400 });
  }
  throw new Error(`Unexpected PayPal call: ${method} ${url.pathname}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  for (const send of Object.values(email)) send.mockResolvedValue({ success: true });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.stubEnv("PAYPAL_ENV", "sandbox");
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-1");
  vi.stubEnv("PAYPAL_STATE_SECRET", "s".repeat(40));
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
  paypalRequests = [];
  paypalRoutes = new Map();
  vi.stubGlobal("fetch", vi.fn(fakePaypalFetch));
  resetPaypalTokenCacheForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

// --- connect -----------------------------------------------------------------------------------

describe("buildConnectUrl", () => {
  it("builds the Log in with PayPal URL with a signed web state", () => {
    const url = paypalService.buildConnectUrl({ userId: BORROWER_ID, platform: "web" });

    const prefix =
      "https://www.sandbox.paypal.com/signin/authorize?flowEntry=static&client_id=client-id" +
      "&response_type=code" +
      "&scope=openid%20email%20https%3A%2F%2Furi.paypal.com%2Fservices%2Fpaypalattributes" +
      "&redirect_uri=https%3A%2F%2Fapp.test%2Fapi%2Fpaypal%2Fcallback&state=";
    expect(url.startsWith(prefix)).toBe(true);
    const state = verifyState(decodeURIComponent(url.slice(prefix.length)));
    expect(state).toMatchObject({ userId: BORROWER_ID, platform: "web" });
    expect(state).not.toHaveProperty("scheme");
  });

  it("puts the allow-listed iOS scheme for the app variant in the state", () => {
    for (const [appVariant, scheme] of [
      ["development", "brokebesties-dev"],
      ["preview", "brokebesties-preview"],
      ["production", "brokebesties"],
      [null, "brokebesties"],
      ["evil://x", "brokebesties"],
    ]) {
      const url = new URL(
        paypalService.buildConnectUrl({ userId: BORROWER_ID, platform: "ios", appVariant }),
      );
      expect(verifyState(url.searchParams.get("state"))).toMatchObject({
        userId: BORROWER_ID,
        platform: "ios",
        scheme,
      });
    }
  });

  it("throws PaypalConfigError when PayPal isn't configured", () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "");
    expect(() => paypalService.buildConnectUrl({ userId: BORROWER_ID, platform: "web" })).toThrow(
      PaypalConfigError,
    );
  });
});

describe("handleOAuthCallback", () => {
  const webState = () => signState({ userId: BORROWER_ID, platform: "web" });
  const iosState = () =>
    signState({ userId: BORROWER_ID, platform: "ios", scheme: "brokebesties-dev" });
  const callback = paypalService.handleOAuthCallback.bind(paypalService);

  function mockPaypalLogin(
    userInfo: unknown = {
      payer_id: "PAYER-B",
      emails: [
        { value: "old@pp.example", primary: false, confirmed: true },
        { value: "bob@pp.example", primary: true, confirmed: "true" },
      ],
    },
  ) {
    onPaypal("POST", "/v1/oauth2/token", json(200, { access_token: "user-token", expires_in: 900 }));
    onPaypal("GET", "/v1/identity/oauth2/userinfo", json(200, userInfo));
  }

  it("links the account and sends the browser back to the profile", async () => {
    mockPaypalLogin();

    const target = await callback({ code: "auth-code", state: webState() });

    expect(target).toBe("https://app.test/profile?paypal=connected");
    const [exchange] = paypalCalls("POST", "/v1/oauth2/token");
    expect(exchange.body).toBe("grant_type=authorization_code&code=auth-code");
    const [userinfo] = paypalCalls("GET", "/v1/identity/oauth2/userinfo");
    expect(userinfo.headers.get("authorization")).toBe("Bearer user-token");
    expect(db.paypalAccount.findUnique).toHaveBeenCalledWith({
      where: { payerId: "PAYER-B" },
      select: { userId: true },
    });
    expect(db.paypalAccount.upsert).toHaveBeenCalledWith({
      where: { userId: BORROWER_ID },
      create: {
        userId: BORROWER_ID,
        payerId: "PAYER-B",
        email: "bob@pp.example",
        emailVerified: true,
      },
      update: {
        payerId: "PAYER-B",
        email: "bob@pp.example",
        emailVerified: true,
        connectedAt: expect.any(Date),
      },
    });
    // the user's PayPal token is never stored
    expect(JSON.stringify(db.paypalAccount.upsert.mock.calls)).not.toContain("user-token");
  });

  it("re-connecting your own PayPal account updates it", async () => {
    mockPaypalLogin();
    db.paypalAccount.findUnique.mockResolvedValueOnce({ userId: BORROWER_ID });

    expect(await callback({ code: "auth-code", state: webState() })).toBe(
      "https://app.test/profile?paypal=connected",
    );
    expect(db.paypalAccount.upsert).toHaveBeenCalledTimes(1);
  });

  it("sends iOS back to the app scheme carried in the state", async () => {
    mockPaypalLogin();

    expect(await callback({ code: "auth-code", state: iosState() })).toBe(
      "brokebesties-dev://paypal/connected?status=ok",
    );
  });

  it("falls back to the first email, then to email/email_verified", async () => {
    mockPaypalLogin({
      payer_id: "P1",
      emails: [{ value: "first@pp.example", confirmed: false }, { value: "second@pp.example" }],
    });
    await callback({ code: "c", state: webState() });
    expect(db.paypalAccount.upsert.mock.calls[0][0].create).toMatchObject({
      email: "first@pp.example",
      emailVerified: false,
    });

    mockPaypalLogin({ payer_id: "P2", email: "solo@pp.example", email_verified: "true" });
    await callback({ code: "c", state: webState() });
    expect(db.paypalAccount.upsert.mock.calls[1][0].create).toMatchObject({
      email: "solo@pp.example",
      emailVerified: true,
    });
  });

  it("rejects a tampered, missing or expired state without calling PayPal", async () => {
    const error = "https://app.test/profile?paypal=error&reason=state";
    const [payload, signature] = webState().split(".");

    expect(await callback({ code: "c", state: `${payload}.${signature}x` })).toBe(error);
    expect(await callback({ code: "c", state: null })).toBe(error);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    const state = webState();
    vi.setSystemTime(new Date("2026-10-04T12:10:00Z"));
    expect(await callback({ code: "c", state })).toBe(error);

    expect(paypalRequests).toHaveLength(0);
    expect(db.paypalAccount.upsert).not.toHaveBeenCalled();
  });

  it("sends a bad iOS state to its scheme only when the scheme is allow-listed", async () => {
    const [payload] = iosState().split(".");
    expect(await callback({ code: "c", state: `${payload}.forged` })).toBe(
      "brokebesties-dev://paypal/connected?status=error&reason=state",
    );

    const evil = Buffer.from(
      JSON.stringify({ userId: BORROWER_ID, platform: "ios", scheme: "https://evil.example" }),
    ).toString("base64url");
    expect(await callback({ code: "c", state: `${evil}.forged` })).toBe(
      "https://app.test/profile?paypal=error&reason=state",
    );
  });

  it("reports a cancelled consent", async () => {
    expect(await callback({ code: null, state: webState(), error: "access_denied" })).toBe(
      "https://app.test/profile?paypal=error&reason=cancelled",
    );
    expect(await callback({ code: null, state: iosState() })).toBe(
      "brokebesties-dev://paypal/connected?status=error&reason=cancelled",
    );
    expect(paypalRequests).toHaveLength(0);
  });

  it("requires a payer id and an email", async () => {
    mockPaypalLogin({ emails: [{ value: "bob@pp.example", primary: true }] });
    expect(await callback({ code: "c", state: webState() })).toBe(
      "https://app.test/profile?paypal=error&reason=no_payer_id",
    );

    mockPaypalLogin({ payer_id: "P1", emails: [{ primary: true }] });
    expect(await callback({ code: "c", state: webState() })).toBe(
      "https://app.test/profile?paypal=error&reason=no_email",
    );
    expect(db.paypalAccount.upsert).not.toHaveBeenCalled();
  });

  it("refuses a PayPal account already linked to another user", async () => {
    mockPaypalLogin();
    db.paypalAccount.findUnique.mockResolvedValueOnce({ userId: OUTSIDER_ID });

    expect(await callback({ code: "c", state: iosState() })).toBe(
      "brokebesties-dev://paypal/connected?status=error&reason=in_use",
    );
    expect(db.paypalAccount.upsert).not.toHaveBeenCalled();
  });

  it("reports in_use when another user links the same account concurrently (P2002)", async () => {
    mockPaypalLogin();
    db.paypalAccount.upsert.mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    expect(await callback({ code: "c", state: webState() })).toBe(
      "https://app.test/profile?paypal=error&reason=in_use",
    );
  });

  it("maps PayPal, configuration and unexpected failures to reasons", async () => {
    onPaypal(
      "POST",
      "/v1/oauth2/token",
      json(400, { error: "invalid_grant", error_description: "Invalid code" }),
    );
    expect(await callback({ code: "c", state: webState() })).toBe(
      "https://app.test/profile?paypal=error&reason=paypal",
    );

    mockPaypalLogin();
    db.paypalAccount.upsert.mockRejectedValueOnce(new Error("connection reset"));
    expect(await callback({ code: "c", state: webState() })).toBe(
      "https://app.test/profile?paypal=error&reason=error",
    );

    const state = webState();
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
    expect(await callback({ code: "c", state })).toBe(
      "https://app.test/profile?paypal=error&reason=config",
    );
    vi.stubEnv("PAYPAL_STATE_SECRET", "");
    expect(await callback({ code: "c", state })).toBe(
      "https://app.test/profile?paypal=error&reason=config",
    );
  });
});

describe("getAccount / disconnect", () => {
  it("returns the linked account or null", async () => {
    const account = { email: "bob@pp.example", emailVerified: true, connectedAt: new Date() };
    db.paypalAccount.findUnique.mockResolvedValueOnce(account).mockResolvedValueOnce(null);

    expect(await paypalService.getAccount(BORROWER_ID)).toEqual(account);
    expect(await paypalService.getAccount(BORROWER_ID)).toBeNull();
    expect(db.paypalAccount.findUnique).toHaveBeenCalledWith({
      where: { userId: BORROWER_ID },
      select: { email: true, emailVerified: true, connectedAt: true },
    });
  });

  it("unlinks the account (idempotent)", async () => {
    db.paypalAccount.deleteMany.mockResolvedValueOnce({ count: 0 });

    await paypalService.disconnect(BORROWER_ID);

    expect(db.paypalAccount.deleteMany).toHaveBeenCalledWith({ where: { userId: BORROWER_ID } });
  });
});

describe("getDebtPaypalInfo", () => {
  const debt = makeDebt({ id: 42 });

  it("lets only the borrower of a payable debt pay, and only once the lender connected", async () => {
    const cases: [string, typeof debt, boolean, boolean, boolean][] = [
      [BORROWER_ID, debt, false, true, true],
      [LENDER_ID, debt, false, true, false],
      [BORROWER_ID, { ...debt, status: "paid" }, false, true, false],
      [BORROWER_ID, debt, true, true, false],
      [BORROWER_ID, debt, false, false, false],
    ];
    for (const [viewer, d, hasPending, lenderConnected, canPay] of cases) {
      db.paypalAccount.findUnique.mockResolvedValueOnce(lenderConnected ? { id: "acc" } : null);
      db.paypalPayment.findMany.mockResolvedValueOnce([]);

      expect(await paypalService.getDebtPaypalInfo(d, viewer, hasPending)).toEqual({
        lenderConnected,
        canPay,
        payments: [],
      });
    }
    expect(db.paypalAccount.findUnique).toHaveBeenCalledWith({
      where: { userId: LENDER_ID },
      select: { id: true },
    });
    expect(paypalRequests).toHaveLength(0);
  });

  it("can't pay while a PayPal payment is pending (APPROVED), however old", async () => {
    db.paypalAccount.findUnique.mockResolvedValueOnce({ id: "acc" });
    db.paypalPayment.findMany.mockResolvedValueOnce([
      { id: "pay_1", status: "APPROVED", amountCents: 4250, createdAt: new Date(0), completedAt: null },
    ]);

    const info = await paypalService.getDebtPaypalInfo(debt, BORROWER_ID, false);

    expect(info).toMatchObject({ lenderConnected: true, canPay: false });
  });

  it("lists the debt's payments newest first", async () => {
    const payments = [
      { id: "pay_2", status: "CREATED", amountCents: 4250, createdAt: new Date(), completedAt: null },
      { id: "pay_1", status: "FAILED", amountCents: 4250, createdAt: new Date(), completedAt: null },
    ];
    db.paypalAccount.findUnique.mockResolvedValueOnce({ id: "acc" });
    db.paypalPayment.findMany.mockResolvedValueOnce(payments);

    const info = await paypalService.getDebtPaypalInfo(debt, BORROWER_ID, false);

    expect(info.payments).toEqual(payments);
    expect(db.paypalPayment.findMany).toHaveBeenCalledWith({
      where: { debtId: 42 },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, amountCents: true, createdAt: true, completedAt: true },
    });
  });
});
