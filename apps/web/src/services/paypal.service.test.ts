import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

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
import { paypalService, type PaypalCapture } from "@/services/paypal.service";
import { resetPaypalTokenCacheForTests, signState, verifyState } from "@/lib/paypal";
import { PaypalConfigError, PaypalFlowError } from "@/lib/paypal-errors";
import {
  BORROWER_ID,
  LENDER_ID,
  createMockPrisma,
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
  // Like Prisma: a guarded update answers how many rows it changed.
  db.paypalPayment.updateMany.mockResolvedValue({ count: 1 });
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
    // No pre-check read: the unique payerId constraint decides (see the in_use test).
    expect(db.paypalAccount.findUnique).not.toHaveBeenCalled();
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

  it("refuses a PayPal account linked to another user (unique payerId → P2002)", async () => {
    const linkedElsewhere = () =>
      db.paypalAccount.upsert.mockRejectedValueOnce(
        Object.assign(new Error("Unique constraint failed on the fields: (`payerId`)"), { code: "P2002" }),
      );

    mockPaypalLogin();
    linkedElsewhere();
    expect(await callback({ code: "c", state: iosState() })).toBe(
      "brokebesties-dev://paypal/connected?status=error&reason=in_use",
    );

    mockPaypalLogin();
    linkedElsewhere();
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
        enabled: true,
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

  it("stays dark while PayPal isn't configured: not enabled and can't pay, the rest as usual", async () => {
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "");
    const payments = [
      { id: "pay_1", status: "COMPLETED", amountCents: 4250, createdAt: new Date(0), completedAt: new Date(0) },
    ];
    db.paypalAccount.findUnique.mockResolvedValueOnce({ id: "acc" });
    db.paypalPayment.findMany.mockResolvedValueOnce(payments);

    expect(await paypalService.getDebtPaypalInfo(debt, BORROWER_ID, false)).toEqual({
      enabled: false,
      lenderConnected: true,
      canPay: false,
      payments,
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

  it("can't pay while a capture that didn't match the payment is unresolved", async () => {
    db.paypalAccount.findUnique.mockResolvedValueOnce({ id: "acc" });
    db.paypalPayment.findMany.mockResolvedValueOnce([
      { id: "pay_1", status: "FAILED", amountCents: 4250, createdAt: new Date(0), completedAt: null },
    ]);
    db.paypalPayment.findFirst.mockResolvedValueOnce({ id: "pay_1" });

    const info = await paypalService.getDebtPaypalInfo(debt, BORROWER_ID, false);

    expect(info).toMatchObject({ lenderConnected: true, canPay: false });
    expect(db.paypalPayment.findFirst).toHaveBeenCalledWith({
      where: {
        debtId: 42,
        status: "FAILED",
        captureId: { not: null },
        failureReason: { contains: "doesn't match the payment" },
      },
      select: { id: true },
    });
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

// --- pay -----------------------------------------------------------------------------------------

/** The error a promise rejects with (fails the test if it resolves). */
async function rejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error("expected the promise to reject");
    },
    (error: unknown) => error,
  );
}

function flowError(status: number, message: string, body?: Record<string, unknown>) {
  const error = expect.objectContaining({ status, message, ...(body ? { body } : {}) });
  return { error, check: (actual: unknown) => {
    expect(actual).toBeInstanceOf(PaypalFlowError);
    expect(actual).toEqual(error);
  } };
}

function paypalError(status: number, issue?: string) {
  return json(status, {
    name: status >= 500 ? "INTERNAL_SERVER_ERROR" : "UNPROCESSABLE_ENTITY",
    message: "PayPal says no",
    debug_id: "debug-1",
    details: issue ? [{ issue, description: issue }] : [],
  });
}

describe("createDebtOrder", () => {
  const payableDebt = (overrides: Record<string, unknown> = {}) => ({
    ...makeDebt({ id: 42, amount: 42.5, description: "Dinner" }),
    lender: { paypalAccount: { payerId: "LENDER-PAYER" } },
    transactions: [],
    ...overrides,
  });
  type OrderParams = Partial<Parameters<typeof paypalService.createDebtOrder>[0]>;
  const order = (params: OrderParams = {}) =>
    paypalService.createDebtOrder({ debtId: 42, userId: BORROWER_ID, platform: "web", ...params });
  /** The in-progress lookup's row: by default a web order for the lender's current account. */
  const inProgressRow = (overrides: Record<string, unknown> = {}) => ({
    id: "pay_old",
    status: "CREATED",
    orderId: "ORDER-OLD",
    platform: "web",
    returnScheme: null,
    payeePayerId: "LENDER-PAYER",
    ...overrides,
  });

  function mockOrderCreated(links = [{ rel: "payer-action", href: "https://pp.example/checkout?token=ORDER-NEW" }]) {
    db.paypalPayment.create.mockResolvedValueOnce({ id: "pay_new" });
    onPaypal("POST", "/v2/checkout/orders", json(201, { id: "ORDER-NEW", status: "PAYER_ACTION_REQUIRED", links }));
  }

  // The order transaction runs on the same mocks (tx === db), plus the row lock query.
  let lockDebt: Mock;
  let inTransaction: boolean;
  beforeEach(() => {
    lockDebt = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
    inTransaction = false;
    db.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => {
      inTransaction = true;
      try {
        return await fn({ ...db, $queryRaw: lockDebt });
      } finally {
        inTransaction = false;
      }
    });
  });

  it("locks the debt row, then checks and creates in that transaction; PayPal is called after it", async () => {
    const steps: string[] = [];
    lockDebt.mockImplementation(async () => {
      steps.push(`lock in tx: ${inTransaction}`);
      return [{ "?column?": 1 }];
    });
    db.paypalPayment.findFirst.mockImplementation(async () => {
      steps.push(`check in tx: ${inTransaction}`);
      return null;
    });
    db.paypalPayment.create.mockImplementation(async () => {
      steps.push(`create in tx: ${inTransaction}`);
      return { id: "pay_new" };
    });
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).endsWith("/v2/checkout/orders")) steps.push(`PayPal in tx: ${inTransaction}`);
      return fakePaypalFetch(String(input), init);
    });
    db.debt.findUnique.mockResolvedValueOnce(payableDebt());
    onPaypal("POST", "/v2/checkout/orders", json(201, { id: "ORDER-NEW", links: [{ rel: "payer-action", href: "https://pp.example/x" }] }));

    await order();

    expect(steps).toEqual([
      "lock in tx: true",
      "check in tx: true",
      "create in tx: true",
      "PayPal in tx: false",
    ]);
    const [sql, ...params] = lockDebt.mock.calls[0];
    expect(sql.join("?")).toBe('SELECT 1 FROM "Debt" WHERE id = ? FOR UPDATE');
    expect(params).toEqual([42]);
  });

  it("answers 404 when the debt is gone by the time it's locked", async () => {
    db.debt.findUnique.mockResolvedValueOnce(payableDebt());
    lockDebt.mockResolvedValueOnce([]);

    flowError(404, "Debt not found").check(await rejection(order()));
    expect(db.paypalPayment.create).not.toHaveBeenCalled();
    expect(paypalRequests).toHaveLength(0);
  });

  it("checks the PayPal configuration before reading anything", async () => {
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
    expect(await rejection(order())).toBeInstanceOf(PaypalConfigError);

    vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(await rejection(order())).toBeInstanceOf(PaypalConfigError);

    expect(db.debt.findUnique).not.toHaveBeenCalled();
  });

  it("rejects missing, foreign, paid and contested debts in order", async () => {
    db.debt.findUnique.mockResolvedValueOnce(null);
    flowError(404, "Debt not found").check(await rejection(order()));

    db.debt.findUnique.mockResolvedValueOnce(payableDebt());
    flowError(403, "Only the borrower can pay this debt with PayPal").check(
      await rejection(order({ userId: LENDER_ID })),
    );

    db.debt.findUnique.mockResolvedValueOnce(payableDebt({ status: "paid", transactions: [{ id: 9 }] }));
    flowError(403, "This debt is already paid").check(await rejection(order()));

    db.debt.findUnique.mockResolvedValueOnce(payableDebt({ transactions: [{ id: 9 }] }));
    flowError(403, "This debt has a pending change request").check(await rejection(order()));

    db.debt.findUnique.mockResolvedValueOnce(payableDebt({ lender: { paypalAccount: null } }));
    flowError(409, "The lender hasn't connected PayPal yet").check(await rejection(order()));

    expect(db.debt.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      include: {
        lender: { select: { paypalAccount: { select: { payerId: true } } } },
        transactions: { where: { status: "pending" }, select: { id: true } },
      },
    });
    expect(db.paypalPayment.create).not.toHaveBeenCalled();
    expect(paypalRequests).toHaveLength(0);
  });

  it("blocks on CREATED orders for 3 hours, CREATED rows without an order for 2 minutes, APPROVED always", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000);
    type Row = {
      id: string;
      status: string;
      orderId: string | null;
      createdAt: Date;
      captureId?: string | null;
      failureReason?: string | null;
      platform?: string;
      returnScheme?: string | null;
      payeePayerId?: string;
    };
    type Condition = {
      status: string;
      orderId?: null | { not: null };
      createdAt?: { gt: Date };
      captureId?: { not: null };
      failureReason?: { contains: string };
    };
    let rows: Row[] = [];
    // Evaluates the in-progress query like Postgres would (checked against a real DB too).
    db.paypalPayment.findFirst.mockImplementation(async ({ where }: { where: { OR: Condition[] } }) =>
      rows.find((row) =>
        where.OR.some(
          (c) =>
            row.status === c.status &&
            (c.orderId === undefined || (c.orderId === null ? row.orderId === null : row.orderId !== null)) &&
            (!c.createdAt || row.createdAt > c.createdAt.gt) &&
            (!c.captureId || row.captureId != null) &&
            (!c.failureReason || !!row.failureReason?.includes(c.failureReason.contains)),
        ),
      ) ?? null,
    );
    const blocked = async (row: Row) => {
      rows = [{ ...inProgressRow(), ...row }];
      db.debt.findUnique.mockResolvedValueOnce(payableDebt());
      db.paypalPayment.create.mockResolvedValueOnce({ id: "pay_new" });
      onPaypal("POST", "/v2/checkout/orders", json(201, { id: "ORDER-NEW", links: [{ rel: "payer-action", href: "https://pp.example/x" }] }));
      const result = await order().catch((error: unknown) => error);
      paypalRoutes.clear();
      return result instanceof PaypalFlowError && result.status === 409;
    };

    expect(await blocked({ id: "p", status: "APPROVED", orderId: "O", createdAt: ago(300) })).toBe(true);
    expect(await blocked({ id: "p", status: "CREATED", orderId: "O", createdAt: ago(179) })).toBe(true);
    expect(await blocked({ id: "p", status: "CREATED", orderId: "O", createdAt: ago(181) })).toBe(false);
    expect(await blocked({ id: "p", status: "CREATED", orderId: null, createdAt: ago(1) })).toBe(true);
    expect(await blocked({ id: "p", status: "CREATED", orderId: null, createdAt: ago(3) })).toBe(false);
    // A capture that didn't match moved money: it blocks at any age, until it's refunded.
    const unmatched = { id: "p", status: "FAILED", orderId: "O", captureId: "C-1", createdAt: ago(9000) };
    const mismatchReason = "Capture C-1 doesn't match the payment: payee SOMEONE-ELSE";
    expect(await blocked({ ...unmatched, failureReason: mismatchReason })).toBe(true);
    expect(await blocked({ ...unmatched, status: "REFUNDED", failureReason: mismatchReason })).toBe(false);
    // A denied pending capture keeps its capture id but moved no money; other failures have none.
    expect(await blocked({ ...unmatched, failureReason: "PayPal denied capture C-1" })).toBe(false);
    expect(
      await blocked({ ...unmatched, captureId: null, failureReason: "Order creation failed: doesn't match the payment" }),
    ).toBe(false);

    expect(db.paypalPayment.findFirst).toHaveBeenLastCalledWith({
      where: {
        debtId: 42,
        OR: [
          { status: "CREATED", orderId: { not: null }, createdAt: { gt: new Date("2026-10-04T09:00:00Z") } },
          { status: "CREATED", orderId: null, createdAt: { gt: new Date("2026-10-04T11:58:00Z") } },
          { status: "APPROVED" },
          { status: "FAILED", captureId: { not: null }, failureReason: { contains: "doesn't match the payment" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, orderId: true, platform: true, returnScheme: true, payeePayerId: true },
    });
  });

  it.each<[string, Record<string, unknown>, OrderParams]>([
    ["web order", {}, {}],
    [
      "iOS order from the same app variant",
      { platform: "ios", returnScheme: "brokebesties-preview" },
      { platform: "ios", appVariant: "preview" },
    ],
  ])("returns an in-progress %s for the same payee so the client can resume it", async (_label, row, params) => {
    db.debt.findUnique.mockResolvedValueOnce(payableDebt());
    db.paypalPayment.findFirst.mockResolvedValueOnce(inProgressRow(row));

    flowError(409, "A PayPal payment is already in progress for this debt", {
      paymentId: "pay_old",
      approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER-OLD",
    }).check(await rejection(order(params)));
    expect(db.paypalPayment.updateMany).not.toHaveBeenCalled();
    expect(db.paypalPayment.create).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, unknown>, OrderParams]>([
    ["an iOS order when paying on the web", { platform: "ios", returnScheme: "brokebesties" }, {}],
    ["a web order when paying in the app", {}, { platform: "ios" }],
    [
      "an order from another iOS app variant",
      { platform: "ios", returnScheme: "brokebesties-preview" },
      { platform: "ios", appVariant: "development" },
    ],
    ["an order paying the lender's previous PayPal account", { payeePayerId: "OLD-PAYER" }, {}],
  ])("replaces %s with a new order", async (_label, row, params) => {
    db.debt.findUnique.mockResolvedValueOnce(payableDebt());
    db.paypalPayment.findFirst.mockResolvedValueOnce(inProgressRow(row));
    let replacedInTransaction: boolean | undefined;
    db.paypalPayment.updateMany.mockImplementationOnce(async () => {
      replacedInTransaction = inTransaction;
      return { count: 1 };
    });
    mockOrderCreated();

    expect(await order(params)).toEqual({
      paymentId: "pay_new",
      approveUrl: "https://pp.example/checkout?token=ORDER-NEW",
    });
    // Under the debt row lock, guarded on CREATED: FAILED is terminal for capture, so approving
    // the old order later moves no money.
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_old", status: "CREATED" },
      data: { status: "FAILED", failureReason: "Replaced by a new PayPal payment" },
    });
    expect(replacedInTransaction).toBe(true);
    expect(db.paypalPayment.create.mock.calls[0][0].data).toMatchObject({
      payeePayerId: "LENDER-PAYER",
      platform: params.platform ?? "web",
    });
  });

  it("still answers in progress when the order to replace changed meanwhile", async () => {
    db.debt.findUnique.mockResolvedValueOnce(payableDebt());
    db.paypalPayment.findFirst.mockResolvedValueOnce(inProgressRow({ platform: "ios", returnScheme: "brokebesties" }));
    db.paypalPayment.updateMany.mockResolvedValueOnce({ count: 0 });

    flowError(409, "A PayPal payment is already in progress for this debt", {
      paymentId: "pay_old",
      approveUrl: null,
    }).check(await rejection(order()));
    expect(db.paypalPayment.create).not.toHaveBeenCalled();
    expect(paypalRequests).toHaveLength(0);
  });

  it("blocks without a resume link while a capture is pending or the order isn't created yet", async () => {
    // Never replaced, even from another platform or for another payee: only a CREATED order is.
    const elsewhere = { platform: "ios", returnScheme: "brokebesties", payeePayerId: "OLD-PAYER" };
    for (const inProgress of [
      inProgressRow({ status: "APPROVED", ...elsewhere }),
      inProgressRow({ orderId: null, ...elsewhere }),
    ]) {
      db.debt.findUnique.mockResolvedValueOnce(payableDebt());
      db.paypalPayment.findFirst.mockResolvedValueOnce(inProgress);
      flowError(409, "A PayPal payment is already in progress for this debt", {
        paymentId: "pay_old",
        approveUrl: null,
      }).check(await rejection(order()));
    }
    expect(db.paypalPayment.updateMany).not.toHaveBeenCalled();
    expect(db.paypalPayment.create).not.toHaveBeenCalled();
  });

  it("blocks new orders while a capture that didn't match the payment is unresolved", async () => {
    db.debt.findUnique.mockResolvedValueOnce(payableDebt());
    db.paypalPayment.findFirst.mockResolvedValueOnce({ id: "pay_old", status: "FAILED", orderId: "ORDER-OLD" });

    flowError(409, "A PayPal payment for this debt couldn't be matched. Check your email before paying again.", {
      paymentId: "pay_old",
      approveUrl: null,
    }).check(await rejection(order()));
    expect(db.paypalPayment.create).not.toHaveBeenCalled();
    expect(paypalRequests).toHaveLength(0);
  });

  it("rejects an amount below one cent", async () => {
    db.debt.findUnique.mockResolvedValueOnce(payableDebt({ amount: 0.004 }));
    flowError(400, "This debt amount can't be paid with PayPal").check(await rejection(order()));
    expect(db.paypalPayment.create).not.toHaveBeenCalled();
  });

  it("creates the payment, then the order with the DB amount and the lender as payee", async () => {
    db.debt.findUnique.mockResolvedValueOnce(payableDebt({ amount: 19.99 }));
    mockOrderCreated();

    const result = await order();

    expect(result).toEqual({
      paymentId: "pay_new",
      approveUrl: "https://pp.example/checkout?token=ORDER-NEW",
    });
    expect(db.paypalPayment.create).toHaveBeenCalledWith({
      data: {
        debtId: 42,
        payerUserId: BORROWER_ID,
        payeeUserId: LENDER_ID,
        payeePayerId: "LENDER-PAYER",
        amountCents: 1999,
        currency: "USD",
        platform: "web",
        returnScheme: null,
      },
    });
    const [request] = paypalCalls("POST", "/v2/checkout/orders");
    expect(request.headers.get("paypal-request-id")).toBe("pay_new");
    expect(JSON.parse(request.body!)).toEqual({
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: "debt-42",
          custom_id: "pay_new",
          description: "Broke Besties: Dinner (debt #42)",
          amount: { currency_code: "USD", value: "19.99" },
          payee: { merchant_id: "LENDER-PAYER" },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Broke Besties",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: "https://app.test/paypal/return?pp=pay_new&platform=web",
            cancel_url: "https://app.test/paypal/return?pp=pay_new&platform=web&cancelled=1",
          },
        },
      },
    });
    expect(db.paypalPayment.update).toHaveBeenCalledWith({
      where: { id: "pay_new" },
      data: { orderId: "ORDER-NEW" },
    });
  });

  it("returns iOS payments to the app scheme for the variant", async () => {
    db.debt.findUnique.mockResolvedValueOnce(payableDebt());
    mockOrderCreated([{ rel: "approve", href: "https://pp.example/approve" }]);

    const result = await order({ platform: "ios", appVariant: "preview" });

    expect(result.approveUrl).toBe("https://pp.example/approve");
    expect(db.paypalPayment.create.mock.calls[0][0].data).toMatchObject({
      platform: "ios",
      returnScheme: "brokebesties-preview",
    });
    const body = JSON.parse(paypalCalls("POST", "/v2/checkout/orders")[0].body!);
    expect(body.payment_source.paypal.experience_context.return_url).toBe(
      "https://app.test/paypal/return?pp=pay_new&platform=ios",
    );
  });

  it("keeps the order description within 127 UTF-16 units without splitting a character", async () => {
    for (const description of [null, "x".repeat(200), "🍕".repeat(200), `a${"🍕".repeat(200)}`]) {
      db.debt.findUnique.mockResolvedValueOnce(payableDebt({ description }));
      mockOrderCreated();
      await order();
    }

    const [none, ascii, pizza, mixed] = paypalCalls("POST", "/v2/checkout/orders").map(
      (call) => JSON.parse(call.body!).purchase_units[0].description as string,
    );
    expect(none).toBe("Broke Besties: debt #42");
    // 127 - "Broke Besties: " (15) - " (debt #42)" (11) = 101 units for the text; 🍕 is 2 units.
    expect(ascii).toBe(`Broke Besties: ${"x".repeat(101)} (debt #42)`);
    expect(pizza).toBe(`Broke Besties: ${"🍕".repeat(50)} (debt #42)`);
    expect(mixed).toBe(`Broke Besties: a${"🍕".repeat(50)} (debt #42)`);
    for (const text of [ascii, pizza, mixed]) {
      expect(text.length).toBeLessThanOrEqual(127);
      expect(text.isWellFormed()).toBe(true);
    }
  });

  it("marks the payment FAILED and answers 502 when PayPal fails", async () => {
    for (const failure of [
      paypalError(500),
      paypalError(422, "INVALID_PARAMETER_VALUE"),
      new TypeError("fetch failed"),
      json(201, { id: "ORDER-NEW", links: [] }),
    ]) {
      db.debt.findUnique.mockResolvedValueOnce(payableDebt());
      db.paypalPayment.create.mockResolvedValueOnce({ id: "pay_new" });
      onPaypal("POST", "/v2/checkout/orders", failure);

      flowError(502, "PayPal couldn't start the payment. Try again.").check(await rejection(order()));
    }
    expect(db.paypalPayment.updateMany).toHaveBeenCalledTimes(4);
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_new", status: { in: ["CREATED", "APPROVED", "CANCELLED"] } },
      data: { status: "FAILED", failureReason: expect.stringContaining("Order creation failed") },
    });
    expect(db.paypalPayment.update).not.toHaveBeenCalled();
  });

  it("answers 409 when PayPal rejects the lender as payee", async () => {
    db.debt.findUnique.mockResolvedValueOnce(payableDebt());
    db.paypalPayment.create.mockResolvedValueOnce({ id: "pay_new" });
    onPaypal("POST", "/v2/checkout/orders", paypalError(422, "PAYEE_ACCOUNT_RESTRICTED"));

    flowError(409, "The lender's PayPal account can't receive payments right now").check(
      await rejection(order()),
    );
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });
});

describe("getReturnRedirect", () => {
  const payment = (overrides: Record<string, unknown> = {}) => ({
    id: "pay_1",
    debtId: 42,
    orderId: "ORDER-1",
    status: "CREATED",
    platform: "web",
    returnScheme: null,
    ...overrides,
  });
  const redirect = (params: Partial<Parameters<typeof paypalService.getReturnRedirect>[0]> = {}) =>
    paypalService.getReturnRedirect({ paymentId: "pay_1", orderToken: "ORDER-1", cancelled: false, ...params });

  it("sends web payers back to the debt", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(payment());

    expect(await redirect()).toBe("https://app.test/debts/42?paypal=approved&pp=pay_1");
    expect(db.paypalPayment.findUnique).toHaveBeenCalledWith({ where: { id: "pay_1" } });
    expect(db.paypalPayment.updateMany).not.toHaveBeenCalled();
  });

  it("sends iOS payers back to the stored app scheme, re-checked against the allow-list", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(payment({ platform: "ios", returnScheme: "brokebesties-preview" }))
      .mockResolvedValueOnce(payment({ platform: "ios", returnScheme: "javascript" }));

    expect(await redirect()).toBe("brokebesties-preview://paypal/return?pp=pay_1&status=approved");
    expect(await redirect()).toBe("brokebesties://paypal/return?pp=pay_1&status=approved");
  });

  it("marks a still-CREATED payment CANCELLED when the order token matches", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(payment());

    expect(await redirect({ cancelled: true })).toBe(
      "https://app.test/debts/42?paypal=cancelled&pp=pay_1",
    );
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: "CREATED" },
      data: { status: "CANCELLED" },
    });
  });

  it("doesn't cancel when the order token doesn't match", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(payment())
      .mockResolvedValueOnce(payment({ orderId: null }));

    expect(await redirect({ cancelled: true, orderToken: "ORDER-OTHER" })).toBe(
      "https://app.test/debts/42?paypal=cancelled&pp=pay_1",
    );
    expect(await redirect({ cancelled: true, orderToken: null })).toBe(
      "https://app.test/debts/42?paypal=cancelled&pp=pay_1",
    );
    expect(db.paypalPayment.updateMany).not.toHaveBeenCalled();
  });

  it("falls back to the debts list for unknown payments and errors, and never throws", async () => {
    expect(await redirect({ paymentId: null })).toBe("https://app.test/debts?paypal=error");

    db.paypalPayment.findUnique.mockResolvedValueOnce(null);
    expect(await redirect()).toBe("https://app.test/debts?paypal=error");

    db.paypalPayment.findUnique.mockRejectedValueOnce(new Error("db down"));
    expect(await redirect()).toBe("https://app.test/debts?paypal=error");
  });

  it("returns a relative path when NEXT_PUBLIC_APP_URL is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    db.paypalPayment.findUnique.mockResolvedValueOnce(payment({ debtId: null }));

    expect(await redirect()).toBe("/debts?paypal=approved&pp=pay_1");
  });
});

// --- capture + settlement ------------------------------------------------------------------------

const UPDATED_AT = new Date("2026-10-04T10:00:00Z");

const paymentRow = (overrides: Record<string, unknown> = {}) => ({
  id: "pay_1",
  debtId: 42,
  payerUserId: BORROWER_ID,
  payeeUserId: LENDER_ID,
  payeePayerId: "LENDER-PAYER",
  amountCents: 4250,
  currency: "USD",
  orderId: "ORDER-1",
  captureId: null,
  status: "CREATED",
  failureReason: null,
  platform: "web",
  returnScheme: null,
  createdAt: UPDATED_AT,
  updatedAt: UPDATED_AT,
  completedAt: null,
  ...overrides,
});

/** The payment as completeFromCapture/markRefunded load it (with both people and the debt). */
const paymentWithParties = (overrides: Record<string, unknown> = {}) =>
  paymentRow({
    payer: { name: "Bob", email: "bob@example.com" },
    payee: { name: "Larry", email: "larry@example.com" },
    debt: { description: "Dinner" },
    ...overrides,
  });

const captureObject = (overrides: Record<string, unknown> = {}) => ({
  id: "CAPTURE-1",
  status: "COMPLETED",
  amount: { currency_code: "USD", value: "42.50" },
  payee: { merchant_id: "LENDER-PAYER" },
  custom_id: "pay_1",
  ...overrides,
});

const capturedOrder = (capture: Record<string, unknown> = captureObject()) => ({
  id: "ORDER-1",
  status: "COMPLETED",
  purchase_units: [{ payee: { merchant_id: "LENDER-PAYER" }, payments: { captures: [capture] } }],
});

/**
 * A settlement transaction client: `claimed`/`settled` are the guarded updateMany counts and
 * `debt` is what the transaction reads before settling.
 */
function mockSettlement({
  claimed = 1,
  debt = { status: "pending", amount: 42.5, alertId: 7 } as Record<string, unknown> | null,
  settled = 1,
} = {}) {
  const tx = createMockPrisma();
  tx.paypalPayment.updateMany.mockResolvedValue({ count: claimed });
  tx.debt.findUnique.mockResolvedValue(debt);
  tx.debt.updateMany.mockResolvedValue({ count: settled });
  db.$transaction.mockImplementationOnce(async (fn: (client: unknown) => unknown) => fn(tx));
  return tx;
}

const CAPTURE_PATH = "/v2/checkout/orders/ORDER-1/capture";
const ORDER_PATH = "/v2/checkout/orders/ORDER-1";
const captureKey = (updatedAt: Date) => `capture-pay_1-${updatedAt.getTime()}`;

/** PayPal's order before anything was captured (approved, no payments yet). */
const mockUncapturedOrder = (times = 1) => {
  for (let i = 0; i < times; i++) {
    onPaypal("GET", ORDER_PATH, json(200, { id: "ORDER-1", status: "APPROVED", purchase_units: [{}] }));
  }
};

/** The debt the pre-capture check reads: still pending, still the ordered amount and payee. */
const unchangedDebt = (overrides: Record<string, unknown> = {}) => ({
  status: "pending",
  amount: 42.5,
  lender: { paypalAccount: { payerId: "LENDER-PAYER" } },
  ...overrides,
});
const mockUnchangedDebt = () => db.debt.findUnique.mockResolvedValue(unchangedDebt());

describe("capturePayment", () => {
  const capture = () => paypalService.capturePayment("pay_1", BORROWER_ID);
  const debtWithParties = { ...makeDebt({ id: 42, status: "paid" }), lender: {}, borrower: {} };

  beforeEach(mockUnchangedDebt);

  it("checks the PayPal configuration first", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "");
    expect(await rejection(capture())).toBeInstanceOf(PaypalConfigError);
    expect(db.paypalPayment.findUnique).not.toHaveBeenCalled();
  });

  it("only lets the payer capture their own payment", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(null);
    flowError(404, "Payment not found").check(await rejection(capture()));

    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentRow());
    flowError(403, "Only the payer can capture this payment").check(
      await rejection(paypalService.capturePayment("pay_1", LENDER_ID)),
    );
    expect(paypalRequests).toHaveLength(0);
  });

  it("returns an already COMPLETED payment as is (idempotent)", async () => {
    const completedAt = new Date();
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow({ status: "COMPLETED" }))
      .mockResolvedValueOnce(paymentRow({ status: "COMPLETED", completedAt, debt: debtWithParties }));

    expect(await capture()).toEqual({
      httpStatus: 200,
      payment: { id: "pay_1", status: "COMPLETED", amountCents: 4250, createdAt: UPDATED_AT, completedAt },
      debt: debtWithParties,
    });
    expect(paypalRequests).toHaveLength(0);
  });

  it("refuses refunded, failed and never-ordered payments without calling PayPal", async () => {
    // Settled payments answer from a fresh read of the row (captureResult).
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow({ status: "REFUNDED" }))
      .mockResolvedValueOnce(paymentRow({ status: "REFUNDED" }));
    flowError(409, "This PayPal payment was refunded").check(await rejection(capture()));

    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow({ status: "FAILED" }))
      .mockResolvedValueOnce(paymentRow({ status: "FAILED" }));
    flowError(409, "This PayPal payment failed. Start a new payment.").check(await rejection(capture()));

    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentRow({ orderId: null }));
    flowError(409, "Payment wasn't approved in PayPal").check(await rejection(capture()));

    expect(paypalRequests).toHaveLength(0);
    expect(db.debt.findUnique).not.toHaveBeenCalled();
  });

  it("captures and settles the debt: paid, audit record, alert off, requests cancelled, lender emailed", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentWithParties())
      .mockResolvedValueOnce(paymentRow({ status: "COMPLETED", completedAt: new Date(), debt: debtWithParties }));
    onPaypal("POST", CAPTURE_PATH, json(201, capturedOrder()));
    const tx = mockSettlement();

    const result = await capture();

    expect(result).toMatchObject({ httpStatus: 200, payment: { status: "COMPLETED" }, debt: debtWithParties });
    const [request] = paypalCalls("POST", CAPTURE_PATH);
    expect(request.body).toBe("{}");
    expect(request.headers.get("prefer")).toBe("return=representation");
    expect(request.headers.get("paypal-request-id")).toBe(captureKey(UPDATED_AT));

    expect(tx.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { notIn: ["COMPLETED", "REFUNDED"] } },
      data: { status: "COMPLETED", captureId: "CAPTURE-1", completedAt: expect.any(Date), failureReason: null },
    });
    expect(tx.debt.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: { status: true, amount: true, alertId: true },
    });
    expect(tx.debt.updateMany).toHaveBeenCalledWith({
      where: { id: 42, status: "pending", amount: 42.5 },
      data: { status: "paid" },
    });
    expect(tx.alert.updateMany).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { isActive: false },
    });
    expect(tx.debtTransaction.updateMany).toHaveBeenCalledWith({
      where: { debtId: 42, status: "pending" },
      data: { status: "cancelled", resolvedAt: expect.any(Date) },
    });
    expect(tx.debtTransaction.create).toHaveBeenCalledWith({
      data: {
        debtId: 42,
        type: "confirm_paid",
        status: "approved",
        requesterId: BORROWER_ID,
        lenderApproved: true,
        borrowerApproved: true,
        reason: "Paid with PayPal (capture CAPTURE-1)",
        resolvedAt: expect.any(Date),
      },
    });
    expect(email.sendPaypalPaymentReceived).toHaveBeenCalledTimes(1);
    expect(email.sendPaypalPaymentReceived).toHaveBeenCalledWith({
      to: "larry@example.com",
      recipientName: "Larry",
      borrowerName: "Bob",
      lenderName: "Larry",
      amount: 42.5,
      description: "Dinner",
      debtLink: "https://app.test/debts/42",
      alreadySettled: false,
    });
  });

  it("takes the payee from the purchase unit when the capture doesn't carry it", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentWithParties())
      .mockResolvedValueOnce(paymentRow({ status: "COMPLETED", debt: debtWithParties }));
    onPaypal("POST", CAPTURE_PATH, json(201, capturedOrder(captureObject({ payee: undefined }))));
    const tx = mockSettlement();

    expect(await capture()).toMatchObject({ httpStatus: 200 });
    expect(tx.debtTransaction.create).toHaveBeenCalledTimes(1);
    expect(paypalCalls("GET", "/v2/checkout/orders/ORDER-1")).toHaveLength(0);
  });

  it("marks a PENDING capture APPROVED and answers 202", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentRow({ status: "APPROVED", captureId: "CAPTURE-1" }));
    onPaypal("POST", CAPTURE_PATH, json(201, capturedOrder(captureObject({ status: "PENDING" }))));

    expect(await capture()).toEqual({
      httpStatus: 202,
      payment: { id: "pay_1", status: "APPROVED", amountCents: 4250, createdAt: UPDATED_AT, completedAt: null },
    });
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
      data: { status: "APPROVED", captureId: "CAPTURE-1", failureReason: null },
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("answers 402 for a declined instrument and keeps the payment resumable", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentRow());
    onPaypal("POST", CAPTURE_PATH, paypalError(422, "INSTRUMENT_DECLINED"));

    flowError(402, "PayPal declined the payment method. Try again with a different one.").check(
      await rejection(capture()),
    );
    // status untouched; the write only bumps updatedAt so the retry uses a fresh PayPal-Request-Id
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
      data: { failureReason: "INSTRUMENT_DECLINED" },
    });
  });

  it("answers 409 when the buyer hasn't approved the order yet", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentRow({ status: "CANCELLED" }));
    onPaypal("POST", CAPTURE_PATH, paypalError(422, "ORDER_NOT_APPROVED"));

    flowError(409, "Payment wasn't approved in PayPal").check(await rejection(capture()));
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
      data: { failureReason: "ORDER_NOT_APPROVED" },
    });
  });

  it("retries a declined capture with a new PayPal-Request-Id", async () => {
    const afterDecline = new Date("2026-10-04T10:05:00Z");
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentRow({ updatedAt: afterDecline, failureReason: "INSTRUMENT_DECLINED" }))
      .mockResolvedValueOnce(paymentWithParties())
      .mockResolvedValueOnce(paymentRow({ status: "COMPLETED", debt: debtWithParties }));
    onPaypal(
      "POST",
      CAPTURE_PATH,
      paypalError(422, "INSTRUMENT_DECLINED"),
      json(201, capturedOrder()),
    );
    mockSettlement();

    await rejection(capture());
    expect(await capture()).toMatchObject({ httpStatus: 200 });

    expect(paypalCalls("POST", CAPTURE_PATH).map((c) => c.headers.get("paypal-request-id"))).toEqual([
      captureKey(UPDATED_AT),
      captureKey(afterDecline),
    ]);
  });

  it("leaves the payment untouched when the outcome is unknown, so a retry replays it", async () => {
    for (const failure of [
      paypalError(500),
      paypalError(503),
      new TypeError("fetch failed"),
      new DOMException("The operation was aborted due to timeout", "TimeoutError"),
      paypalError(409),
      paypalError(429),
      paypalError(422, "PREVIOUS_REQUEST_IN_PROGRESS"),
      json(201, { id: "ORDER-1", status: "COMPLETED" }),
    ]) {
      db.paypalPayment.findUnique.mockResolvedValueOnce(paymentRow());
      onPaypal("POST", CAPTURE_PATH, failure);
      flowError(502, "PayPal couldn't complete the payment").check(await rejection(capture()));
    }

    expect(new Set(paypalCalls("POST", CAPTURE_PATH).map((c) => c.headers.get("paypal-request-id")))).toEqual(
      new Set([captureKey(UPDATED_AT)]),
    );
    expect(db.paypalPayment.update).not.toHaveBeenCalled();
    expect(db.paypalPayment.updateMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("reconciles ORDER_ALREADY_CAPTURED by reading the order", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentWithParties())
      .mockResolvedValueOnce(paymentRow({ status: "COMPLETED", debt: debtWithParties }));
    onPaypal("POST", CAPTURE_PATH, paypalError(422, "ORDER_ALREADY_CAPTURED"));
    onPaypal("GET", "/v2/checkout/orders/ORDER-1", json(200, capturedOrder()));
    const tx = mockSettlement();

    expect(await capture()).toMatchObject({ httpStatus: 200 });
    expect(tx.debtTransaction.create).toHaveBeenCalledTimes(1);
  });

  it("marks the payment FAILED for a definite PayPal refusal or a failed capture", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentRow());
    onPaypal("POST", CAPTURE_PATH, paypalError(422, "TRANSACTION_REFUSED"));
    flowError(502, "PayPal couldn't complete the payment").check(await rejection(capture()));

    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentRow());
    onPaypal("POST", CAPTURE_PATH, json(201, capturedOrder(captureObject({ status: "DECLINED" }))));
    flowError(502, "PayPal couldn't complete the payment").check(await rejection(capture()));

    expect(db.paypalPayment.updateMany).toHaveBeenCalledTimes(2);
    for (const [args] of db.paypalPayment.updateMany.mock.calls) {
      expect(args).toEqual({
        where: { id: "pay_1", status: { in: ["CREATED", "APPROVED", "CANCELLED"] } },
        data: { status: "FAILED", failureReason: expect.any(String) },
      });
    }
  });

  it("answers 502 telling the payer not to pay again when the capture doesn't match the payment", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentWithParties());
    onPaypal("POST", CAPTURE_PATH, json(201, capturedOrder(captureObject({ amount: { currency_code: "USD", value: "4.25" } }))));

    flowError(
      502,
      "Your PayPal payment went through but couldn't be matched to this debt. Don't pay again: check your email.",
    ).check(await rejection(capture()));
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to capture when the debt amount changed after the order was created", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentRow());
    db.debt.findUnique.mockResolvedValueOnce({ status: "pending", amount: 80 });
    mockUncapturedOrder();

    flowError(409, "This debt's amount changed. Start a new PayPal payment.").check(
      await rejection(capture()),
    );
    expect(db.debt.findUnique).toHaveBeenCalledWith({
      where: { id: 42 },
      select: {
        status: true,
        amount: true,
        lender: { select: { paypalAccount: { select: { payerId: true } } } },
      },
    });
    expect(paypalCalls("GET", ORDER_PATH)).toHaveLength(1);
    expect(paypalCalls("POST", CAPTURE_PATH)).toHaveLength(0);
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
      data: { status: "CANCELLED", failureReason: "Debt amount changed before capture" },
    });
  });

  it("refuses to capture when the debt was paid or deleted meanwhile", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentRow({ status: "CANCELLED" }))
      .mockResolvedValueOnce(paymentRow({ debtId: null }));
    db.debt.findUnique
      .mockResolvedValueOnce({ status: "paid", amount: 42.5 })
      .mockResolvedValueOnce(null);
    mockUncapturedOrder(3);

    for (let attempt = 0; attempt < 3; attempt++) {
      flowError(409, "This debt is already settled").check(await rejection(capture()));
    }

    expect(paypalCalls("GET", ORDER_PATH)).toHaveLength(3);
    expect(paypalCalls("POST", CAPTURE_PATH)).toHaveLength(0);
    expect(db.debt.findUnique).toHaveBeenCalledTimes(2);
    expect(db.paypalPayment.updateMany.mock.calls.map(([args]) => args)).toEqual(
      Array(3).fill({
        where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
        data: { status: "CANCELLED", failureReason: "Debt settled before capture" },
      }),
    );
  });

  it("refuses to capture to the lender's old PayPal account (re-linked or disconnected)", async () => {
    db.paypalPayment.findUnique.mockResolvedValue(paymentRow());
    db.debt.findUnique
      .mockResolvedValueOnce(unchangedDebt({ lender: { paypalAccount: { payerId: "NEW-PAYER" } } }))
      .mockResolvedValueOnce(unchangedDebt({ lender: { paypalAccount: null } }));
    mockUncapturedOrder(2);

    for (let attempt = 0; attempt < 2; attempt++) {
      flowError(409, "The lender's PayPal account changed. Start a new PayPal payment.").check(
        await rejection(capture()),
      );
    }

    expect(paypalCalls("GET", ORDER_PATH)).toHaveLength(2);
    expect(paypalCalls("POST", CAPTURE_PATH)).toHaveLength(0);
    expect(db.paypalPayment.updateMany.mock.calls.map(([args]) => args)).toEqual(
      Array(2).fill({
        where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
        data: { status: "CANCELLED", failureReason: "Lender's PayPal account changed before capture" },
      }),
    );
  });

  it("reports a settled debt first, then a changed amount, then a changed payee", async () => {
    const relinked = { lender: { paypalAccount: { payerId: "NEW-PAYER" } } };
    db.paypalPayment.findUnique.mockResolvedValue(paymentRow());
    db.debt.findUnique
      .mockResolvedValueOnce(unchangedDebt({ status: "paid", amount: 80, ...relinked }))
      .mockResolvedValueOnce(unchangedDebt({ amount: 80, ...relinked }));
    mockUncapturedOrder(2);

    flowError(409, "This debt is already settled").check(await rejection(capture()));
    flowError(409, "This debt's amount changed. Start a new PayPal payment.").check(
      await rejection(capture()),
    );
  });

  it("asks PayPal before refusing: a capture whose answer was lost is settled, not cancelled", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentWithParties())
      .mockResolvedValueOnce(paymentRow({ status: "COMPLETED", completedAt: new Date(), debt: debtWithParties }));
    db.debt.findUnique.mockResolvedValueOnce({ status: "pending", amount: 80 });
    onPaypal("GET", ORDER_PATH, json(200, capturedOrder()));
    const tx = mockSettlement({ debt: { status: "pending", amount: 80, alertId: 7 } });

    expect(await capture()).toMatchObject({ httpStatus: 200, payment: { status: "COMPLETED" } });
    expect(paypalCalls("POST", CAPTURE_PATH)).toHaveLength(0);
    expect(db.paypalPayment.updateMany).not.toHaveBeenCalled();
    expect(tx.paypalPayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", captureId: "CAPTURE-1" }) }),
    );
    expect(tx.debt.updateMany).not.toHaveBeenCalled();
    expect(email.sendPaypalPaymentReceived.mock.calls.map(([params]) => [params.to, params.alreadySettled])).toEqual([
      ["larry@example.com", true],
      ["bob@example.com", true],
    ]);
  });

  it("asks PayPal before refusing: a pending capture makes the payment APPROVED", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentRow({ status: "APPROVED", captureId: "CAPTURE-1" }));
    db.debt.findUnique.mockResolvedValueOnce({ status: "paid", amount: 42.5 });
    onPaypal("GET", ORDER_PATH, json(200, capturedOrder(captureObject({ status: "PENDING" }))));

    expect(await capture()).toMatchObject({ httpStatus: 202, payment: { status: "APPROVED" } });
    expect(paypalCalls("POST", CAPTURE_PATH)).toHaveLength(0);
    expect(db.paypalPayment.updateMany).toHaveBeenCalledTimes(1);
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
      data: { status: "APPROVED", captureId: "CAPTURE-1", failureReason: null },
    });
  });

  it("answers with a racing capture's result when the refused payment can no longer be cancelled", async () => {
    // The CHECKOUT.ORDER.APPROVED webhook's capture (PENDING) landed between our order read and
    // the guarded cancel, so the cancel matches no row.
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentRow({ status: "APPROVED", captureId: "CAPTURE-1" }));
    db.debt.findUnique.mockResolvedValueOnce({ status: "pending", amount: 80 });
    mockUncapturedOrder();
    db.paypalPayment.updateMany.mockResolvedValueOnce({ count: 0 });

    expect(await capture()).toMatchObject({ httpStatus: 202, payment: { status: "APPROVED" } });
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
      data: { status: "CANCELLED", failureReason: "Debt amount changed before capture" },
    });
  });

  it("leaves the payment untouched when PayPal can't say whether an earlier capture went through", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentRow());
    db.debt.findUnique.mockResolvedValueOnce({ status: "pending", amount: 80 });
    onPaypal("GET", ORDER_PATH, paypalError(503));

    flowError(502, "PayPal couldn't complete the payment").check(await rejection(capture()));
    expect(paypalCalls("GET", ORDER_PATH)).toHaveLength(1);
    expect(paypalCalls("POST", CAPTURE_PATH)).toHaveLength(0);
    expect(db.paypalPayment.updateMany).not.toHaveBeenCalled();
  });

  it("skips the debt check for an APPROVED payment (its capture is already in flight)", async () => {
    db.debt.findUnique.mockResolvedValue({ status: "pending", amount: 80 });
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow({ status: "APPROVED", captureId: "CAPTURE-1" }))
      .mockResolvedValueOnce(paymentRow({ status: "APPROVED", captureId: "CAPTURE-1" }));
    onPaypal("POST", CAPTURE_PATH, paypalError(422, "ORDER_ALREADY_CAPTURED"));
    onPaypal(
      "GET",
      "/v2/checkout/orders/ORDER-1",
      json(200, capturedOrder(captureObject({ status: "PENDING" }))),
    );

    expect(await capture()).toMatchObject({ httpStatus: 202 });
    expect(db.debt.findUnique).not.toHaveBeenCalled();
  });
});

describe("completeFromCapture", () => {
  const complete = (capture: Record<string, unknown> = captureObject()) =>
    paypalService.completeFromCapture("pay_1", capture as PaypalCapture);

  beforeEach(mockUnchangedDebt);

  it("settles exactly once when the client capture and the webhook race", async () => {
    // One shared row: both completions read it before either claims it, so the guarded
    // updateMany is the only thing serializing them.
    let status = "CREATED";
    db.paypalPayment.findUnique.mockImplementation(async (args: { include?: { payer?: unknown } }) =>
      args.include?.payer ? paymentWithParties() : paymentRow({ status, debt: null }),
    );
    const tx = createMockPrisma();
    tx.paypalPayment.updateMany.mockImplementation(
      async ({ where }: { where: { status: { notIn: string[] } } }) => {
        if (where.status.notIn.includes(status)) return { count: 0 };
        status = "COMPLETED";
        return { count: 1 };
      },
    );
    tx.debt.findUnique.mockResolvedValue({ status: "pending", amount: 42.5, alertId: null });
    tx.debt.updateMany.mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(tx));
    onPaypal("POST", CAPTURE_PATH, json(201, capturedOrder()));

    const [fromClient, fromWebhook] = await Promise.all([
      paypalService.capturePayment("pay_1", BORROWER_ID),
      complete(),
    ]);

    expect(fromClient.httpStatus).toBe(200);
    expect(fromWebhook).toBe("completed");
    expect(tx.paypalPayment.updateMany).toHaveBeenCalledTimes(2);
    expect(tx.debtTransaction.create).toHaveBeenCalledTimes(1);
    expect(email.sendPaypalPaymentReceived).toHaveBeenCalledTimes(1);
  });

  it("marks the payment FAILED, leaves the debt alone and emails both people on an amount, currency or payee mismatch", async () => {
    for (const mismatch of [
      { amount: { currency_code: "USD", value: "42.49" } },
      { amount: { currency_code: "USD", value: "42.5000001" } },
      { amount: { currency_code: "EUR", value: "42.50" } },
      { payee: { merchant_id: "SOMEONE-ELSE" } },
    ]) {
      db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties());
      expect(await complete(captureObject(mismatch))).toBe("failed");
    }

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.debt.updateMany).not.toHaveBeenCalled();
    // The capture id is stored so a later refund/reversal that only carries it still matches.
    expect(db.paypalPayment.updateMany.mock.calls.map(([args]) => args)).toEqual(
      Array(4).fill({
        where: { id: "pay_1", status: { in: ["CREATED", "APPROVED", "CANCELLED"] } },
        data: {
          status: "FAILED",
          failureReason: expect.stringMatching(/^Capture CAPTURE-1 doesn't match the payment: /),
          captureId: "CAPTURE-1",
        },
      }),
    );
    expect(console.error).toHaveBeenCalled();
    // The money moved but the debt didn't change: both people hear not to pay again.
    expect(email.sendPaypalPaymentReceived.mock.calls.map(([params]) => [params.to, params.alreadySettled])).toEqual(
      Array(4).fill([["larry@example.com", true], ["bob@example.com", true]]).flat(),
    );
  });

  it("emails a mismatch only once (a racing call or a redelivery matches no row)", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties({ status: "FAILED", captureId: "CAPTURE-1" }));
    db.paypalPayment.updateMany.mockResolvedValueOnce({ count: 0 });

    expect(await complete(captureObject({ payee: { merchant_id: "SOMEONE-ELSE" } }))).toBe("failed");
    expect(email.sendPaypalPaymentReceived).not.toHaveBeenCalled();
  });

  it("looks the payee up on the order when the capture doesn't carry it", async () => {
    const withoutPayee = captureObject({ payee: undefined });
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties());
    onPaypal("GET", "/v2/checkout/orders/ORDER-1", json(200, capturedOrder()));
    mockSettlement();
    expect(await complete(withoutPayee)).toBe("completed");

    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties());
    onPaypal("GET", "/v2/checkout/orders/ORDER-1", json(200, { id: "ORDER-1", purchase_units: [{}] }));
    expect(await complete(withoutPayee)).toBe("failed");
  });

  it("does nothing for a payment that is already COMPLETED or REFUNDED", async () => {
    for (const status of ["COMPLETED", "REFUNDED"]) {
      db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties({ status }));
      expect(await complete()).toBe("already_completed");
    }
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(email.sendPaypalPaymentReceived).not.toHaveBeenCalled();
  });

  it("does nothing when another completion claimed the payment first", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties());
    const tx = mockSettlement({ claimed: 0 });

    expect(await complete()).toBe("already_completed");
    expect(tx.debt.updateMany).not.toHaveBeenCalled();
    expect(email.sendPaypalPaymentReceived).not.toHaveBeenCalled();
  });

  it("keeps the payment COMPLETED and emails both people when the debt was already paid", async () => {
    for (const settlement of [
      { debt: { status: "paid", amount: 42.5, alertId: 7 } },
      { debt: null }, // deleted after the payment was read
      { settled: 0 }, // changed between the read and the guarded update
    ]) {
      db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties());
      const tx = mockSettlement(settlement);

      expect(await complete()).toBe("already_settled");
      expect(tx.paypalPayment.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.debtTransaction.create).not.toHaveBeenCalled();
      expect(tx.alert.updateMany).not.toHaveBeenCalled();
    }
    expect(email.sendPaypalPaymentReceived.mock.calls.map(([params]) => [params.to, params.alreadySettled])).toEqual(
      Array(3).fill([["larry@example.com", true], ["bob@example.com", true]]).flat(),
    );
  });

  it("doesn't mark the debt paid when its amount changed after checkout started", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties());
    const tx = mockSettlement({ debt: { status: "pending", amount: 80, alertId: 7 } });

    expect(await complete()).toBe("already_settled");
    expect(tx.paypalPayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }),
    );
    expect(tx.debt.updateMany).not.toHaveBeenCalled();
    expect(tx.alert.updateMany).not.toHaveBeenCalled();
    expect(tx.debtTransaction.updateMany).not.toHaveBeenCalled();
    expect(tx.debtTransaction.create).not.toHaveBeenCalled();
    expect(email.sendPaypalPaymentReceived.mock.calls.map(([params]) => [params.to, params.alreadySettled])).toEqual([
      ["larry@example.com", true],
      ["bob@example.com", true],
    ]);
  });

  it("treats a deleted debt as already settled", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties({ debtId: null, debt: null }));
    const tx = mockSettlement();

    expect(await complete()).toBe("already_settled");
    expect(tx.debt.updateMany).not.toHaveBeenCalled();
    expect(email.sendPaypalPaymentReceived).toHaveBeenCalledTimes(2);
    expect(email.sendPaypalPaymentReceived).toHaveBeenCalledWith(
      expect.objectContaining({ description: null, debtLink: "https://app.test/debts" }),
    );
  });

  it("emails only after the transaction commits, and an email failure doesn't fail the call", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties());
    const tx = mockSettlement();
    tx.debtTransaction.create.mockRejectedValueOnce(new Error("insert failed"));
    await expect(complete()).rejects.toThrow("insert failed");
    expect(email.sendPaypalPaymentReceived).not.toHaveBeenCalled();

    db.paypalPayment.findUnique.mockResolvedValueOnce(paymentWithParties());
    mockSettlement();
    email.sendPaypalPaymentReceived.mockResolvedValueOnce({ success: false, error: "Resend down" });
    expect(await complete()).toBe("completed");
  });

  it("refuses a capture that isn't COMPLETED", async () => {
    await expect(complete(captureObject({ status: "PENDING" }))).rejects.toThrow();
    expect(db.paypalPayment.findUnique).not.toHaveBeenCalled();
  });
});

// --- refunds + webhooks --------------------------------------------------------------------------

describe("markRefunded", () => {
  const completed = (overrides: Record<string, unknown> = {}) =>
    paymentWithParties({ status: "COMPLETED", captureId: "CAPTURE-1", ...overrides });

  function mockRefund({
    claimed = 1,
    current = { debtId: 42, captureId: "CAPTURE-1" } as { debtId: number | null; captureId: string | null },
    latestReason = "Paid with PayPal (capture CAPTURE-1)",
    reopened = 1,
  } = {}) {
    const tx = createMockPrisma();
    tx.paypalPayment.updateMany.mockResolvedValue({ count: claimed });
    tx.paypalPayment.findUnique.mockResolvedValue(current);
    tx.debtTransaction.findFirst.mockResolvedValue(latestReason ? { reason: latestReason } : null);
    tx.debt.updateMany.mockResolvedValue({ count: reopened });
    db.$transaction.mockImplementationOnce(async (fn: (client: unknown) => unknown) => fn(tx));
    return tx;
  }

  const refundEmails = () =>
    email.sendPaypalPaymentRefunded.mock.calls.map(([params]) => [params.to, params.debtReopened]);

  it("puts the debt back to pending, records the refund and emails both people", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(completed());
    const tx = mockRefund();

    await paypalService.markRefunded("pay_1");

    expect(tx.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { not: "REFUNDED" } },
      data: { status: "REFUNDED" },
    });
    expect(tx.debtTransaction.findFirst).toHaveBeenCalledWith({
      where: { debtId: 42, type: "confirm_paid", status: "approved" },
      orderBy: [{ resolvedAt: { sort: "desc", nulls: "last" } }, { id: "desc" }],
      select: { reason: true },
    });
    expect(tx.debt.updateMany).toHaveBeenCalledWith({
      where: { id: 42, status: "paid" },
      data: { status: "pending" },
    });
    expect(tx.debtTransaction.create).toHaveBeenCalledWith({
      data: {
        debtId: 42,
        type: "confirm_paid",
        status: "cancelled",
        requesterId: LENDER_ID,
        reason: "PayPal payment refunded",
        resolvedAt: expect.any(Date),
      },
    });
    expect(refundEmails()).toEqual([
      ["larry@example.com", true],
      ["bob@example.com", true],
    ]);
    expect(email.sendPaypalPaymentRefunded).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 42.5, description: "Dinner", debtLink: "https://app.test/debts/42" }),
    );
  });

  it("is idempotent", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(completed({ status: "REFUNDED" }));
    await paypalService.markRefunded("pay_1");
    expect(db.$transaction).not.toHaveBeenCalled();

    db.paypalPayment.findUnique.mockResolvedValueOnce(completed());
    const tx = mockRefund({ claimed: 0 });
    await paypalService.markRefunded("pay_1");
    expect(tx.debt.updateMany).not.toHaveBeenCalled();

    expect(email.sendPaypalPaymentRefunded).not.toHaveBeenCalled();
  });

  it("leaves the debt alone when this capture isn't what marked it paid", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(completed());
    const tx = mockRefund({ latestReason: "Paid with PayPal (capture CAPTURE-OTHER)" });

    await paypalService.markRefunded("pay_1");

    expect(tx.debt.updateMany).not.toHaveBeenCalled();
    expect(tx.debtTransaction.create).not.toHaveBeenCalled();
    expect(refundEmails()).toEqual([
      ["larry@example.com", false],
      ["bob@example.com", false],
    ]);
  });

  it("doesn't reopen a debt that isn't paid any more", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(completed());
    const tx = mockRefund({ reopened: 0 });

    await paypalService.markRefunded("pay_1");

    expect(tx.debtTransaction.create).not.toHaveBeenCalled();
    expect(refundEmails()).toEqual([
      ["larry@example.com", false],
      ["bob@example.com", false],
    ]);
  });

  it("marks a payment that never settled REFUNDED without touching the debt", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(completed({ status: "APPROVED", captureId: null }));
    const tx = mockRefund({ current: { debtId: 42, captureId: null } });

    await paypalService.markRefunded("pay_1");

    expect(tx.paypalPayment.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.debtTransaction.findFirst).not.toHaveBeenCalled();
    expect(tx.debt.updateMany).not.toHaveBeenCalled();
  });

  it("unblocks a capture that didn't match: the FAILED payment becomes REFUNDED, the debt stays", async () => {
    db.paypalPayment.findUnique.mockResolvedValueOnce(
      completed({ status: "FAILED", failureReason: "Capture CAPTURE-1 doesn't match the payment: amount 4.25" }),
    );
    const tx = mockRefund({ latestReason: "" });

    await paypalService.markRefunded("pay_1");

    expect(tx.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { not: "REFUNDED" } },
      data: { status: "REFUNDED" },
    });
    expect(tx.debt.updateMany).not.toHaveBeenCalled();
    expect(refundEmails()).toEqual([
      ["larry@example.com", false],
      ["bob@example.com", false],
    ]);
  });

  it("uses the capture id read inside the transaction (a completion may commit in between)", async () => {
    // Read before the completion committed; by the time the refund claims the row it's settled.
    db.paypalPayment.findUnique.mockResolvedValueOnce(completed({ status: "CREATED", captureId: null }));
    const tx = mockRefund();

    await paypalService.markRefunded("pay_1");

    expect(tx.paypalPayment.findUnique).toHaveBeenCalledWith({
      where: { id: "pay_1" },
      select: { debtId: true, captureId: true },
    });
    expect(tx.debt.updateMany).toHaveBeenCalledWith({
      where: { id: 42, status: "paid" },
      data: { status: "pending" },
    });
    expect(refundEmails()).toEqual([
      ["larry@example.com", true],
      ["bob@example.com", true],
    ]);
  });
});

describe("verifyWebhookSignature", () => {
  const signatureHeaders = {
    "paypal-auth-algo": "SHA256withRSA",
    "paypal-cert-url": "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-1",
    "paypal-transmission-id": "TRANSMISSION-1",
    "paypal-transmission-sig": "c2lnbmF0dXJl",
    "paypal-transmission-time": "2026-10-04T12:00:00Z",
  };
  // Spacing, key order and escapes that re-serializing would change.
  const rawBody = '{"id":"WH-EVT-1",  "event_type":"PAYMENT.CAPTURE.COMPLETED","resource":{"note":"caf\\u00e9"}}';
  const verify = (headers: Record<string, string> = signatureHeaders, body = rawBody) =>
    paypalService.verifyWebhookSignature(new Headers(headers), body);
  const VERIFY_PATH = "/v1/notifications/verify-webhook-signature";

  it("asks PayPal to verify the event with the raw body embedded verbatim", async () => {
    onPaypal("POST", VERIFY_PATH, json(200, { verification_status: "SUCCESS" }));

    expect(await verify()).toBe(true);

    const [request] = paypalCalls("POST", VERIFY_PATH);
    expect(request.headers.get("authorization")).toBe("Bearer app-token");
    expect(request.body!.endsWith(`,"webhook_event":${rawBody}}`)).toBe(true);
    expect(JSON.parse(request.body!)).toEqual({
      auth_algo: "SHA256withRSA",
      cert_url: "https://api-m.sandbox.paypal.com/v1/notifications/certs/CERT-1",
      transmission_id: "TRANSMISSION-1",
      transmission_sig: "c2lnbmF0dXJl",
      transmission_time: "2026-10-04T12:00:00Z",
      webhook_id: "WH-1",
      webhook_event: JSON.parse(rawBody),
    });
  });

  it("is false without every signature header, without calling PayPal", async () => {
    for (const missing of Object.keys(signatureHeaders)) {
      const headers: Record<string, string> = { ...signatureHeaders };
      delete headers[missing];
      expect(await verify(headers)).toBe(false);
    }
    expect(paypalRequests).toHaveLength(0);
  });

  it("is false for a body that isn't a JSON object, so it can't inject fields", async () => {
    for (const body of ["", "garbage", "[]", "null", '{"id":1},"webhook_id":"WH-ATTACKER"']) {
      expect(await verify(signatureHeaders, body)).toBe(false);
    }
    expect(paypalRequests).toHaveLength(0);
  });

  it("is false unless PayPal answers SUCCESS", async () => {
    onPaypal("POST", VERIFY_PATH, json(200, { verification_status: "FAILURE" }), json(200, {}));
    expect(await verify()).toBe(false);
    expect(await verify()).toBe(false);
  });

  it("throws PaypalConfigError when the webhook id or credentials are missing", async () => {
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "");
    expect(await rejection(verify())).toBeInstanceOf(PaypalConfigError);

    vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-1");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
    expect(await rejection(verify())).toBeInstanceOf(PaypalConfigError);
    expect(paypalRequests).toHaveLength(0);
  });

  it("rethrows PayPal errors so the route answers 500 and PayPal retries", async () => {
    onPaypal("POST", VERIFY_PATH, paypalError(503));
    await expect(verify()).rejects.toMatchObject({ status: 503 });
  });
});

describe("handleWebhook", () => {
  /** findUnique finds the row only through the given lookup (or its own id, like the DB). */
  function paymentFoundBy(key: string, value: string, row: Record<string, unknown>) {
    db.paypalPayment.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where[key] === value || where.id === row.id ? row : null,
    );
  }

  beforeEach(mockUnchangedDebt);

  it("captures an approved order (found by the purchase unit's custom_id)", async () => {
    paymentFoundBy("id", "pay_1", paymentRow());
    onPaypal("POST", CAPTURE_PATH, json(201, capturedOrder(captureObject({ status: "PENDING" }))));

    const result = await paypalService.handleWebhook({
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource_type: "checkout-order",
      resource: { id: "ORDER-1", status: "APPROVED", purchase_units: [{ custom_id: "pay_1" }] },
    });

    expect(result).toEqual({ handled: true });
    expect(paypalCalls("POST", CAPTURE_PATH)).toHaveLength(1);
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "APPROVED" }) }),
    );
  });

  it("logs capture flow errors for an approved order instead of throwing", async () => {
    paymentFoundBy("orderId", "ORDER-1", paymentRow());
    onPaypal("POST", CAPTURE_PATH, paypalError(422, "INSTRUMENT_DECLINED"));

    const result = await paypalService.handleWebhook({
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource_type: "checkout-order",
      resource: { id: "ORDER-1" },
    });

    expect(result).toEqual({ handled: true });
    expect(console.error).toHaveBeenCalled();
  });

  const orderApproved = {
    event_type: "CHECKOUT.ORDER.APPROVED",
    resource_type: "checkout-order",
    resource: { id: "ORDER-1", purchase_units: [{ custom_id: "pay_1" }] },
  };

  it("rethrows an unknown capture outcome so PayPal redelivers the event (same key)", async () => {
    for (const status of ["CREATED", "APPROVED", "CANCELLED"]) {
      db.paypalPayment.findUnique
        .mockResolvedValueOnce(paymentRow({ status }))
        .mockResolvedValueOnce({ status }); // re-read: the row is untouched
      onPaypal("POST", CAPTURE_PATH, paypalError(503));

      await expect(paypalService.handleWebhook(orderApproved)).rejects.toMatchObject({
        status: 502,
        message: "PayPal couldn't complete the payment",
      });
      expect(db.paypalPayment.findUnique).toHaveBeenLastCalledWith({
        where: { id: "pay_1" },
        select: { status: true },
      });
    }
  });

  it("only logs a capture that failed for good", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce({ status: "FAILED" }); // re-read: markFailed ran
    onPaypal("POST", CAPTURE_PATH, paypalError(422, "TRANSACTION_REFUSED"));

    expect(await paypalService.handleWebhook(orderApproved)).toEqual({ handled: true });
    expect(console.error).toHaveBeenCalled();
  });

  it("doesn't capture an approved order whose debt amount changed", async () => {
    paymentFoundBy("orderId", "ORDER-1", paymentRow());
    db.debt.findUnique.mockResolvedValue({ status: "pending", amount: 80 });
    mockUncapturedOrder();

    const result = await paypalService.handleWebhook({
      event_type: "CHECKOUT.ORDER.APPROVED",
      resource_type: "checkout-order",
      resource: { id: "ORDER-1" },
    });

    expect(result).toEqual({ handled: true });
    expect(paypalCalls("POST", CAPTURE_PATH)).toHaveLength(0);
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
      data: { status: "CANCELLED", failureReason: "Debt amount changed before capture" },
    });
  });

  it("settles a completed capture", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentWithParties());
    const tx = mockSettlement();

    const result = await paypalService.handleWebhook({
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource_type: "capture",
      resource: captureObject(),
    });

    expect(result).toEqual({ handled: true });
    expect(db.paypalPayment.findUnique).toHaveBeenNthCalledWith(1, { where: { id: "pay_1" } });
    expect(tx.debtTransaction.create).toHaveBeenCalledTimes(1);
  });

  it("keeps a completed capture but leaves the debt alone when its amount changed", async () => {
    db.paypalPayment.findUnique
      .mockResolvedValueOnce(paymentRow())
      .mockResolvedValueOnce(paymentWithParties());
    const tx = mockSettlement({ debt: { status: "pending", amount: 80, alertId: 7 } });

    const result = await paypalService.handleWebhook({
      event_type: "PAYMENT.CAPTURE.COMPLETED",
      resource_type: "capture",
      resource: captureObject(),
    });

    expect(result).toEqual({ handled: true });
    expect(tx.paypalPayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) }),
    );
    expect(tx.debt.updateMany).not.toHaveBeenCalled();
    expect(tx.debtTransaction.create).not.toHaveBeenCalled();
    expect(email.sendPaypalPaymentReceived.mock.calls.map(([params]) => [params.to, params.alreadySettled])).toEqual([
      ["larry@example.com", true],
      ["bob@example.com", true],
    ]);
  });

  it("marks a pending capture APPROVED", async () => {
    paymentFoundBy("orderId", "ORDER-1", paymentRow({ status: "CANCELLED" }));

    const result = await paypalService.handleWebhook({
      event_type: "PAYMENT.CAPTURE.PENDING",
      resource_type: "capture",
      resource: {
        id: "CAPTURE-1",
        status: "PENDING",
        supplementary_data: { related_ids: { order_id: "ORDER-1" } },
      },
    });

    expect(result).toEqual({ handled: true });
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["CREATED", "CANCELLED"] } },
      data: { status: "APPROVED", captureId: "CAPTURE-1", failureReason: null },
    });
  });

  it("marks a denied capture FAILED", async () => {
    paymentFoundBy("captureId", "CAPTURE-1", paymentRow({ status: "APPROVED", captureId: "CAPTURE-1" }));

    const result = await paypalService.handleWebhook({
      event_type: "PAYMENT.CAPTURE.DENIED",
      resource_type: "capture",
      resource: { id: "CAPTURE-1", status: "DECLINED" },
    });

    expect(result).toEqual({ handled: true });
    expect(db.paypalPayment.updateMany).toHaveBeenCalledWith({
      where: { id: "pay_1", status: { in: ["CREATED", "APPROVED", "CANCELLED"] } },
      data: { status: "FAILED", failureReason: expect.stringContaining("CAPTURE-1") },
    });
  });

  it("refunds a payment found through the refund's 'up' link", async () => {
    paymentFoundBy("captureId", "CAPTURE-1", paymentWithParties({ status: "COMPLETED", captureId: "CAPTURE-1" }));
    const tx = createMockPrisma();
    tx.paypalPayment.updateMany.mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementationOnce(async (fn: (client: unknown) => unknown) => fn(tx));

    const result = await paypalService.handleWebhook({
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource_type: "refund",
      resource: {
        id: "REFUND-1",
        status: "COMPLETED",
        links: [
          { rel: "self", href: "https://api-m.sandbox.paypal.com/v2/payments/refunds/REFUND-1" },
          { rel: "up", href: "https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE-1" },
        ],
      },
    });

    expect(result).toEqual({ handled: true });
    expect(db.paypalPayment.findUnique).toHaveBeenCalledWith({ where: { captureId: "CAPTURE-1" } });
    expect(db.paypalPayment.findUnique).not.toHaveBeenCalledWith({ where: { captureId: "REFUND-1" } });
    expect(tx.paypalPayment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "REFUNDED" } }),
    );
  });

  it("refunds a reversed payment in full, found through related_ids.capture_id", async () => {
    paymentFoundBy("captureId", "CAPTURE-1", paymentWithParties({ status: "COMPLETED", captureId: "CAPTURE-1" }));
    const tx = createMockPrisma();
    tx.paypalPayment.updateMany.mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementationOnce(async (fn: (client: unknown) => unknown) => fn(tx));

    const result = await paypalService.handleWebhook({
      event_type: "PAYMENT.CAPTURE.REVERSED",
      resource_type: "refund",
      resource: {
        id: "REVERSAL-1",
        amount: { currency_code: "USD", value: "10.00" }, // a reversal is never partial
        supplementary_data: { related_ids: { capture_id: "CAPTURE-1" } },
      },
    });

    expect(result).toEqual({ handled: true });
    expect(db.paypalPayment.findUnique).toHaveBeenCalledWith({ where: { captureId: "CAPTURE-1" } });
    expect(tx.paypalPayment.updateMany).toHaveBeenCalledTimes(1);
  });

  describe("a refund or reversal for a payment without its capture id yet", () => {
    // The capture's outcome was unknown, so our row never learned the capture id.
    const CAPTURE_LOOKUP = "/v2/payments/captures/CAPTURE-1";
    const refundedBeforeCaptured = (type: string) => ({
      event_type: type,
      resource_type: "refund",
      resource: {
        id: "REFUND-1",
        status: "COMPLETED",
        links: [{ rel: "up", href: `https://api-m.sandbox.paypal.com${CAPTURE_LOOKUP}` }],
      },
    });

    beforeEach(() => paymentFoundBy("id", "pay_1", paymentWithParties({ status: "CREATED", captureId: null })));

    it.each(["PAYMENT.CAPTURE.REFUNDED", "PAYMENT.CAPTURE.REVERSED"])(
      "asks PayPal whose capture it is (%s), so the later COMPLETED event can't settle it",
      async (type) => {
        onPaypal("GET", CAPTURE_LOOKUP, json(200, { id: "CAPTURE-1", status: "REFUNDED", custom_id: "pay_1" }));
        const tx = createMockPrisma();
        tx.paypalPayment.updateMany.mockResolvedValue({ count: 1 });
        db.$transaction.mockImplementationOnce(async (fn: (client: unknown) => unknown) => fn(tx));

        expect(await paypalService.handleWebhook(refundedBeforeCaptured(type))).toEqual({ handled: true });

        expect(db.paypalPayment.findUnique).toHaveBeenCalledWith({ where: { captureId: "CAPTURE-1" } });
        expect(paypalCalls("GET", CAPTURE_LOOKUP)).toHaveLength(1);
        expect(db.paypalPayment.findUnique).toHaveBeenCalledWith({ where: { id: "pay_1" } });
        expect(tx.paypalPayment.updateMany).toHaveBeenCalledWith({
          where: { id: "pay_1", status: { not: "REFUNDED" } },
          data: { status: "REFUNDED" },
        });
      },
    );

    it("fails the delivery when PayPal can't be asked, so PayPal sends it again", async () => {
      onPaypal("GET", CAPTURE_LOOKUP, paypalError(503));

      await expect(
        paypalService.handleWebhook(refundedBeforeCaptured("PAYMENT.CAPTURE.REFUNDED")),
      ).rejects.toMatchObject({ status: 503 });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("ignores the event when PayPal's capture isn't one of our payments", async () => {
      onPaypal(
        "GET",
        CAPTURE_LOOKUP,
        json(200, { id: "CAPTURE-1", custom_id: "not-ours" }),
        json(200, { id: "CAPTURE-1" }),
      );

      for (let attempt = 0; attempt < 2; attempt++) {
        expect(await paypalService.handleWebhook(refundedBeforeCaptured("PAYMENT.CAPTURE.REFUNDED"))).toEqual({
          handled: false,
        });
      }
      expect(db.paypalPayment.findUnique).toHaveBeenCalledWith({ where: { id: "not-ours" } });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("doesn't ask PayPal when the event carries no capture id", async () => {
      const event = refundedBeforeCaptured("PAYMENT.CAPTURE.REFUNDED");

      expect(await paypalService.handleWebhook({ ...event, resource: { ...event.resource, links: [] } })).toEqual({
        handled: false,
      });
      expect(paypalRequests).toHaveLength(0);
    });
  });

  describe("refund amounts", () => {
    const usd = (value: string) => ({ currency_code: "USD", value });
    /** A PAYMENT.CAPTURE.REFUNDED event for CAPTURE-1 (a $42.50 payment), found by its 'up' link. */
    const refundEvent = (resource: Record<string, unknown>) => ({
      event_type: "PAYMENT.CAPTURE.REFUNDED",
      resource_type: "refund",
      resource: {
        id: "REFUND-1",
        status: "COMPLETED",
        links: [{ rel: "up", href: "https://api-m.sandbox.paypal.com/v2/payments/captures/CAPTURE-1" }],
        ...resource,
      },
    });
    const refundEmails = () =>
      email.sendPaypalPaymentRefunded.mock.calls.map(([params]) => [params.to, params.refundedAmount, params.debtReopened]);
    /** The full-refund transaction (markRefunded); the debt isn't reopened in these tests. */
    function mockFullRefund() {
      const tx = createMockPrisma();
      tx.paypalPayment.updateMany.mockResolvedValue({ count: 1 });
      db.$transaction.mockImplementationOnce(async (fn: (client: unknown) => unknown) => fn(tx));
      return tx;
    }

    beforeEach(() =>
      paymentFoundBy("captureId", "CAPTURE-1", paymentWithParties({ status: "COMPLETED", captureId: "CAPTURE-1" })),
    );

    it("keeps the payment and the debt as they are for a partial refund, and tells both people", async () => {
      // $10 now, after an earlier $5: the email names this refund, not the total.
      const result = await paypalService.handleWebhook(
        refundEvent({ amount: usd("10.00"), seller_payable_breakdown: { total_refunded_amount: usd("15.00") } }),
      );

      expect(result).toEqual({ handled: true });
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.paypalPayment.updateMany).not.toHaveBeenCalled();
      expect(db.debt.updateMany).not.toHaveBeenCalled();
      expect(refundEmails()).toEqual([
        ["larry@example.com", 10, false],
        ["bob@example.com", 10, false],
      ]);
      expect(email.sendPaypalPaymentRefunded).toHaveBeenCalledWith(expect.objectContaining({ amount: 42.5 }));
    });

    it("refunds in full once the refunds add up to the paid amount", async () => {
      // The second partial refund: $32.50 now, $42.50 refunded in total.
      const tx = mockFullRefund();

      await paypalService.handleWebhook(
        refundEvent({ amount: usd("32.50"), seller_payable_breakdown: { total_refunded_amount: usd("42.50") } }),
      );

      expect(tx.paypalPayment.updateMany).toHaveBeenCalledWith({
        where: { id: "pay_1", status: { not: "REFUNDED" } },
        data: { status: "REFUNDED" },
      });
      expect(refundEmails()).toEqual([
        ["larry@example.com", undefined, false],
        ["bob@example.com", undefined, false],
      ]);
    });

    it("uses the refund's own amount when there's no breakdown, for partial and full refunds", async () => {
      await paypalService.handleWebhook(refundEvent({ amount: usd("10.00") }));
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(refundEmails()).toEqual([
        ["larry@example.com", 10, false],
        ["bob@example.com", 10, false],
      ]);

      email.sendPaypalPaymentRefunded.mockClear();
      const tx = mockFullRefund();
      await paypalService.handleWebhook(refundEvent({ amount: usd("42.50") }));
      expect(tx.paypalPayment.updateMany).toHaveBeenCalledTimes(1);
      expect(refundEmails()).toEqual([
        ["larry@example.com", undefined, false],
        ["bob@example.com", undefined, false],
      ]);
    });

    it("refunds in full when neither amount can be read", async () => {
      const tx = mockFullRefund();

      await paypalService.handleWebhook(
        refundEvent({ amount: usd("ten"), seller_payable_breakdown: { total_refunded_amount: {} } }),
      );

      expect(tx.paypalPayment.updateMany).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores events for unknown payments and event types it doesn't handle", async () => {
    db.paypalPayment.findUnique.mockResolvedValue(null);
    expect(
      await paypalService.handleWebhook({
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource_type: "capture",
        resource: captureObject({ custom_id: "not-ours" }),
      }),
    ).toEqual({ handled: false });

    db.paypalPayment.findUnique.mockClear();
    expect(
      await paypalService.handleWebhook({ event_type: "BILLING.SUBSCRIPTION.CREATED", resource: { id: "X" } }),
    ).toEqual({ handled: false });
    expect(await paypalService.handleWebhook({})).toEqual({ handled: false });
    expect(db.paypalPayment.findUnique).not.toHaveBeenCalled();
  });

  it("lets unexpected errors propagate so PayPal retries", async () => {
    db.paypalPayment.findUnique.mockRejectedValueOnce(new Error("db down"));

    await expect(
      paypalService.handleWebhook({
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource_type: "capture",
        resource: captureObject(),
      }),
    ).rejects.toThrow("db down");
  });
});
