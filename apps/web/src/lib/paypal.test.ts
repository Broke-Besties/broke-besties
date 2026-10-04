import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  APP_SCHEMES,
  amountToCents,
  centsToAmount,
  checkoutUrl,
  decodeStateUnverified,
  exchangeAuthorizationCode,
  fetchUserInfo,
  getAppAccessToken,
  getAppUrl,
  getPaypalCredentials,
  getStateSecret,
  getWebhookId,
  isAppScheme,
  isPaypalConfigured,
  paypalBase,
  paypalEnv,
  paypalFetch,
  paypalWebBase,
  resetPaypalTokenCacheForTests,
  schemeForVariant,
  signState,
  verifyState,
} from "@/lib/paypal";
import { PaypalConfigError, PaypalError } from "@/lib/paypal-errors";

const STATE_SECRET = "s".repeat(32);
const BASIC_AUTH = `Basic ${Buffer.from("client-id:client-secret").toString("base64")}`;

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function tokenResponse(token = "app-token", expiresIn = 32400) {
  return jsonResponse(200, { access_token: token, token_type: "Bearer", expires_in: expiresIn });
}

let fetchMock: Mock;

function callAt(index: number) {
  const [url, init = {}] = fetchMock.mock.calls[index] as [string, RequestInit?];
  return { url: String(url), init, headers: new Headers(init.headers) };
}

beforeEach(() => {
  vi.stubEnv("PAYPAL_ENV", "sandbox");
  vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
  vi.stubEnv("PAYPAL_CLIENT_SECRET", "client-secret");
  vi.stubEnv("PAYPAL_STATE_SECRET", STATE_SECRET);
  vi.stubEnv("PAYPAL_WEBHOOK_ID", "WH-1");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  resetPaypalTokenCacheForTests();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("environment", () => {
  it("is live only when PAYPAL_ENV is exactly 'live'", () => {
    expect(paypalEnv()).toBe("sandbox");
    vi.stubEnv("PAYPAL_ENV", "live");
    expect(paypalEnv()).toBe("live");
    for (const value of ["LIVE", "production", "", " live"]) {
      vi.stubEnv("PAYPAL_ENV", value);
      expect(paypalEnv()).toBe("sandbox");
    }
  });

  it("picks the REST and web base URLs for the environment", () => {
    expect(paypalBase()).toBe("https://api-m.sandbox.paypal.com");
    expect(paypalWebBase()).toBe("https://www.sandbox.paypal.com");
    vi.stubEnv("PAYPAL_ENV", "live");
    expect(paypalBase()).toBe("https://api-m.paypal.com");
    expect(paypalWebBase()).toBe("https://www.paypal.com");
  });
});

describe("config getters", () => {
  it("returns the client credentials and throws PaypalConfigError when one is missing", () => {
    expect(getPaypalCredentials()).toEqual({ clientId: "client-id", clientSecret: "client-secret" });

    vi.stubEnv("PAYPAL_CLIENT_ID", "");
    expect(() => getPaypalCredentials()).toThrow(PaypalConfigError);

    vi.stubEnv("PAYPAL_CLIENT_ID", "client-id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "   ");
    expect(() => getPaypalCredentials()).toThrow(PaypalConfigError);
  });

  it("trims trailing slashes from the app URL and requires it", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test//");
    expect(getAppUrl()).toBe("https://app.test");

    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(() => getAppUrl()).toThrow(PaypalConfigError);
  });

  it("requires a state secret of at least 32 characters", () => {
    expect(getStateSecret()).toBe(STATE_SECRET);

    vi.stubEnv("PAYPAL_STATE_SECRET", "s".repeat(31));
    expect(() => getStateSecret()).toThrow(PaypalConfigError);

    vi.stubEnv("PAYPAL_STATE_SECRET", "");
    expect(() => getStateSecret()).toThrow(PaypalConfigError);
  });

  it("requires the webhook id", () => {
    expect(getWebhookId()).toBe("WH-1");
    vi.stubEnv("PAYPAL_WEBHOOK_ID", "");
    expect(() => getWebhookId()).toThrow(PaypalConfigError);
  });
});

describe("isPaypalConfigured", () => {
  it("is true when every PayPal setting is present and valid", () => {
    expect(isPaypalConfigured()).toBe(true);
  });

  it.each([
    ["PAYPAL_CLIENT_ID", ""],
    ["PAYPAL_CLIENT_SECRET", "  "],
    ["NEXT_PUBLIC_APP_URL", ""],
    ["PAYPAL_STATE_SECRET", ""],
    ["PAYPAL_STATE_SECRET", "s".repeat(31)],
    ["PAYPAL_WEBHOOK_ID", ""],
  ])("is false when %s is %j", (name, value) => {
    vi.stubEnv(name, value);
    expect(isPaypalConfigured()).toBe(false);
  });
});

describe("amountToCents", () => {
  it.each([
    ["42.50", 4250],
    ["42.5", 4250],
    ["42", 4200],
    ["0.01", 1],
    ["0.29", 29],
    ["1.10", 110],
    ["0", 0],
    ["0.00", 0],
    ["042.50", 4250],
    ["42.500", 4250],
    ["9999999.99", 999999999],
  ])("parses %s exactly as %i cents", (value, cents) => {
    expect(amountToCents(value)).toBe(cents);
  });

  it.each([
    ["42.505"],
    ["42.501"],
    ["-1.00"],
    [""],
    [" 42.50"],
    ["42.50 "],
    ["42."],
    [".5"],
    ["4e2"],
    ["0x10"],
    ["1,000.00"],
    ["+42.50"],
    ["NaN"],
    ["Infinity"],
    ["90071992547409.92"],
  ])("rejects %j", (value) => {
    expect(amountToCents(value)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(amountToCents(undefined)).toBeNull();
    expect(amountToCents(null)).toBeNull();
    expect(amountToCents(42.5)).toBeNull();
    expect(amountToCents({ value: "42.50" })).toBeNull();
  });
});

describe("centsToAmount", () => {
  it.each([
    [4250, "42.50"],
    [1, "0.01"],
    [0, "0.00"],
    [100, "1.00"],
    [109, "1.09"],
    [123456789, "1234567.89"],
  ])("formats %i cents as %s", (cents, amount) => {
    expect(centsToAmount(cents)).toBe(amount);
  });

  it("round-trips with amountToCents", () => {
    for (let cents = 0; cents <= 2000; cents++) {
      expect(amountToCents(centsToAmount(cents))).toBe(cents);
    }
    expect(amountToCents(centsToAmount(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
  });

  it("throws for negative or non-integer cents", () => {
    expect(() => centsToAmount(-1)).toThrow(RangeError);
    expect(() => centsToAmount(1.5)).toThrow(RangeError);
    expect(() => centsToAmount(Number.NaN)).toThrow(RangeError);
  });
});

describe("app schemes", () => {
  it("allow-lists the three app variants", () => {
    expect(APP_SCHEMES).toEqual(["brokebesties", "brokebesties-preview", "brokebesties-dev"]);
  });

  it("maps the X-App-Variant value to a scheme", () => {
    expect(schemeForVariant("development")).toBe("brokebesties-dev");
    expect(schemeForVariant("preview")).toBe("brokebesties-preview");
    expect(schemeForVariant("production")).toBe("brokebesties");
    expect(schemeForVariant(null)).toBe("brokebesties");
    expect(schemeForVariant(undefined)).toBe("brokebesties");
    expect(schemeForVariant("javascript")).toBe("brokebesties");
  });

  it("recognizes only allow-listed schemes", () => {
    expect(isAppScheme("brokebesties")).toBe(true);
    expect(isAppScheme("brokebesties-dev")).toBe(true);
    expect(isAppScheme("brokebesties-preview")).toBe(true);
    for (const value of ["https", "javascript", "BROKEBESTIES", "brokebesties-evil", "", null, 1]) {
      expect(isAppScheme(value)).toBe(false);
    }
  });
});

describe("checkoutUrl", () => {
  it("builds the approve URL for an order", () => {
    expect(checkoutUrl("5O190127TN364715T")).toBe(
      "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
    );
    vi.stubEnv("PAYPAL_ENV", "live");
    expect(checkoutUrl("a b&c")).toBe("https://www.paypal.com/checkoutnow?token=a%20b%26c");
  });
});

describe("OAuth state", () => {
  function sign(encodedPayload: string, secret = STATE_SECRET) {
    return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  }

  function encode(value: unknown) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }

  it("round-trips a payload with a 10-minute expiry and a nonce", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));

    const state = signState({ userId: "user-1", platform: "ios", scheme: "brokebesties" });
    const payload = verifyState(state);

    expect(payload).toMatchObject({ userId: "user-1", platform: "ios", scheme: "brokebesties" });
    expect(payload?.exp).toBe(Date.now() + 10 * 60 * 1000);
    expect(typeof payload?.nonce).toBe("string");
    expect(state).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it("adds a fresh nonce each time and ignores a caller-supplied exp", () => {
    const a = signState({ userId: "user-1", exp: Number.MAX_SAFE_INTEGER });
    const b = signState({ userId: "user-1" });

    expect(a).not.toBe(b);
    expect(verifyState(a)?.exp).toBeLessThanOrEqual(Date.now() + 10 * 60 * 1000);
    expect(verifyState(a)?.nonce).not.toBe(verifyState(b)?.nonce);
  });

  it("rejects a tampered payload", () => {
    const state = signState({ userId: "user-1", platform: "web" });
    const [encoded, signature] = state.split(".");
    const forged = { ...JSON.parse(Buffer.from(encoded, "base64url").toString()), userId: "user-2" };

    expect(verifyState(`${encode(forged)}.${signature}`)).toBeNull();
  });

  it("rejects a tampered or foreign signature", () => {
    const state = signState({ userId: "user-1" });
    const [encoded, signature] = state.split(".");
    const flipped = `${signature.slice(0, -1)}${signature.endsWith("A") ? "B" : "A"}`;

    expect(verifyState(`${encoded}.${flipped}`)).toBeNull();
    expect(verifyState(`${encoded}.${sign(encoded, "o".repeat(32))}`)).toBeNull();
    expect(verifyState(`${encoded}.`)).toBeNull();
    // same string length, different byte length: must not throw from timingSafeEqual
    expect(verifyState(`${encoded}.${"é".repeat(signature.length)}`)).toBeNull();
  });

  it("rejects an expired state", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    const state = signState({ userId: "user-1" });

    vi.setSystemTime(new Date("2026-10-04T12:09:59.999Z"));
    expect(verifyState(state)).not.toBeNull();

    vi.setSystemTime(new Date("2026-10-04T12:10:00Z"));
    expect(verifyState(state)).toBeNull();
  });

  it("rejects malformed states", () => {
    const notJson = Buffer.from("not json").toString("base64url");
    const array = encode([1, 2]);
    const noExp = encode({ userId: "user-1" });
    const stringExp = encode({ userId: "user-1", exp: "9999999999999" });

    for (const state of [
      "",
      "abc",
      "a.b.c",
      ".",
      ".abc",
      `${notJson}.${sign(notJson)}`,
      `${array}.${sign(array)}`,
      `${noExp}.${sign(noExp)}`,
      `${stringExp}.${sign(stringExp)}`,
    ]) {
      expect(verifyState(state)).toBeNull();
    }
    expect(verifyState(null)).toBeNull();
    expect(verifyState(undefined)).toBeNull();
  });

  it("throws PaypalConfigError when the secret is missing or short", () => {
    const state = signState({ userId: "user-1" });

    vi.stubEnv("PAYPAL_STATE_SECRET", "");
    expect(() => signState({ userId: "user-1" })).toThrow(PaypalConfigError);
    expect(() => verifyState(state)).toThrow(PaypalConfigError);

    vi.stubEnv("PAYPAL_STATE_SECRET", "short-secret");
    expect(() => signState({ userId: "user-1" })).toThrow(PaypalConfigError);
    expect(() => verifyState(state)).toThrow(PaypalConfigError);
  });

  it("decodes a payload without verifying it, for picking an error redirect only", () => {
    const state = signState({ userId: "user-1", platform: "ios", scheme: "brokebesties-dev" });
    const [encoded] = state.split(".");

    expect(decodeStateUnverified(`${encoded}.forged`)).toMatchObject({
      platform: "ios",
      scheme: "brokebesties-dev",
    });
    expect(decodeStateUnverified("garbage")).toBeNull();
    expect(decodeStateUnverified(`${encode([1])}.sig`)).toBeNull();
    expect(decodeStateUnverified(null)).toBeNull();
  });
});

describe("getAppAccessToken", () => {
  it("requests a client-credentials token with Basic auth and caches it", async () => {
    fetchMock.mockResolvedValueOnce(tokenResponse("t1"));

    expect(await getAppAccessToken()).toBe("t1");
    expect(await getAppAccessToken()).toBe("t1");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init, headers } = callAt(0);
    expect(url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    expect(init.method).toBe("POST");
    expect(headers.get("authorization")).toBe(BASIC_AUTH);
    expect(headers.get("content-type")).toBe("application/x-www-form-urlencoded");
    expect(init.body).toBe("grant_type=client_credentials");
  });

  it("refreshes the token 60 seconds before it expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    fetchMock
      .mockResolvedValueOnce(tokenResponse("t1", 3600))
      .mockResolvedValueOnce(tokenResponse("t2", 3600));

    expect(await getAppAccessToken()).toBe("t1");

    vi.setSystemTime(Date.now() + 3540 * 1000 - 1);
    expect(await getAppAccessToken()).toBe("t1");

    vi.setSystemTime(Date.now() + 1);
    expect(await getAppAccessToken()).toBe("t2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("doesn't cache a failed token request", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { error: "invalid_client", error_description: "Client Authentication failed" }),
      )
      .mockResolvedValueOnce(tokenResponse("t2"));

    await expect(getAppAccessToken()).rejects.toBeInstanceOf(PaypalError);
    expect(await getAppAccessToken()).toBe("t2");
  });

  it("keys the cache by environment and client id", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("sandbox-a"))
      .mockResolvedValueOnce(tokenResponse("sandbox-b"))
      .mockResolvedValueOnce(tokenResponse("live-b"));

    expect(await getAppAccessToken()).toBe("sandbox-a");
    vi.stubEnv("PAYPAL_CLIENT_ID", "client-b");
    expect(await getAppAccessToken()).toBe("sandbox-b");
    vi.stubEnv("PAYPAL_ENV", "live");
    expect(await getAppAccessToken()).toBe("live-b");
    expect(callAt(2).url).toBe("https://api-m.paypal.com/v1/oauth2/token");
  });

  it("throws PaypalConfigError without calling PayPal when credentials are missing", async () => {
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "");
    await expect(getAppAccessToken()).rejects.toBeInstanceOf(PaypalConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a token response without an access token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { token_type: "Bearer" }));
    await expect(getAppAccessToken()).rejects.toThrow("access_token");
  });
});

describe("paypalFetch", () => {
  it("sends Bearer + JSON headers, the request id and custom headers, and parses JSON", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("t1"))
      .mockResolvedValueOnce(jsonResponse(201, { id: "ORDER-1" }));

    const result = await paypalFetch("/v2/checkout/orders", {
      method: "POST",
      body: JSON.stringify({ intent: "CAPTURE" }),
      requestId: "payment-1",
      headers: { Prefer: "return=representation" },
    });

    expect(result).toEqual({ id: "ORDER-1" });
    const { url, init, headers } = callAt(1);
    expect(url).toBe("https://api-m.sandbox.paypal.com/v2/checkout/orders");
    expect(init.method).toBe("POST");
    expect(init.body).toBe('{"intent":"CAPTURE"}');
    expect(headers.get("authorization")).toBe("Bearer t1");
    expect(headers.get("content-type")).toBe("application/json");
    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("paypal-request-id")).toBe("payment-1");
    expect(headers.get("prefer")).toBe("return=representation");
  });

  it("omits PayPal-Request-Id when none is given", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, { status: "APPROVED" }));

    await paypalFetch("/v2/checkout/orders/ORDER-1");

    expect(callAt(1).headers.has("paypal-request-id")).toBe(false);
    expect(callAt(1).init.method ?? "GET").toBe("GET");
  });

  it("uses a given access token instead of the app token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { payer_id: "P1" }));

    await paypalFetch("/v1/identity/oauth2/userinfo?schema=paypalv1.1", { accessToken: "user-token" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(callAt(0).headers.get("authorization")).toBe("Bearer user-token");
  });

  it("retries once with a fresh app token after a 401", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("stale"))
      .mockResolvedValueOnce(
        jsonResponse(401, { name: "AUTHENTICATION_FAILURE", message: "Authentication failed" }),
      )
      .mockResolvedValueOnce(tokenResponse("fresh"))
      .mockResolvedValueOnce(jsonResponse(201, { id: "ORDER-1" }));

    const result = await paypalFetch("/v2/checkout/orders", {
      method: "POST",
      body: "{}",
      requestId: "payment-1",
    });

    expect(result).toEqual({ id: "ORDER-1" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const retry = callAt(3);
    expect(retry.headers.get("authorization")).toBe("Bearer fresh");
    expect(retry.headers.get("paypal-request-id")).toBe("payment-1");
    expect(retry.init.body).toBe("{}");
    // the fresh token replaced the stale one in the cache
    fetchMock.mockResolvedValueOnce(jsonResponse(200, {}));
    await paypalFetch("/v2/checkout/orders/ORDER-1");
    expect(callAt(4).headers.get("authorization")).toBe("Bearer fresh");
  });

  it("gives up after one retry", async () => {
    const unauthorized = () =>
      jsonResponse(401, { name: "AUTHENTICATION_FAILURE", message: "Authentication failed" });
    fetchMock
      .mockResolvedValueOnce(tokenResponse("t1"))
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(tokenResponse("t2"))
      .mockResolvedValueOnce(unauthorized());

    await expect(paypalFetch("/v2/checkout/orders/ORDER-1")).rejects.toMatchObject({
      status: 401,
      paypalName: "AUTHENTICATION_FAILURE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("doesn't retry a 401 for a caller-supplied access token", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: "invalid_token", error_description: "Token is expired" }),
    );

    await expect(
      paypalFetch("/v1/identity/oauth2/userinfo?schema=paypalv1.1", { accessToken: "user-token" }),
    ).rejects.toMatchObject({ status: 401, paypalName: "invalid_token" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns null for an empty success body", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(paypalFetch("/v1/something", { method: "DELETE" })).resolves.toBeNull();
  });

  it("rejects an unreadable success body (outcome unknown, not a PaypalError)", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(new Response("<html>ok</html>", { status: 200 }));

    await expect(paypalFetch("/v2/checkout/orders/ORDER-1")).rejects.toBeInstanceOf(SyntaxError);
  });

  it("passes network failures and timeouts through unchanged", async () => {
    const failure = new TypeError("fetch failed");
    const timeout = new DOMException("The operation was aborted due to timeout", "TimeoutError");
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockRejectedValueOnce(failure)
      .mockRejectedValueOnce(timeout);

    await expect(paypalFetch("/v2/checkout/orders/ORDER-1")).rejects.toBe(failure);
    await expect(paypalFetch("/v2/checkout/orders/ORDER-1")).rejects.toBe(timeout);
  });

  it("gives every request a 30 second timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(jsonResponse(200, {}));

    await paypalFetch("/v2/checkout/orders/ORDER-1");

    expect(timeout).toHaveBeenCalledTimes(2);
    expect(timeout).toHaveBeenCalledWith(30_000);
    expect(callAt(0).init.signal).toBe(timeout.mock.results[0].value);
    expect(callAt(1).init.signal).toBe(timeout.mock.results[1].value);
    timeout.mockRestore();
  });
});

describe("PaypalError parsing", () => {
  async function errorFor(response: Response) {
    fetchMock.mockResolvedValueOnce(response);
    return paypalFetch("/v2/checkout/orders/ORDER-1", { accessToken: "user-token" }).catch(
      (e: unknown) => e,
    );
  }

  it("parses an Orders API error body", async () => {
    const error = await errorFor(
      jsonResponse(422, {
        name: "UNPROCESSABLE_ENTITY",
        message: "The requested action could not be performed.",
        debug_id: "debug-123",
        details: [
          { issue: "INSTRUMENT_DECLINED", description: "The instrument was declined." },
          "junk",
        ],
      }),
    );

    expect(error).toBeInstanceOf(PaypalError);
    expect(error).toMatchObject({
      status: 422,
      paypalName: "UNPROCESSABLE_ENTITY",
      message: "The requested action could not be performed.",
      debugId: "debug-123",
      details: [{ issue: "INSTRUMENT_DECLINED", description: "The instrument was declined." }],
      issue: "INSTRUMENT_DECLINED",
    });
  });

  it("parses an OAuth error body", async () => {
    const error = await errorFor(
      jsonResponse(
        401,
        { error: "invalid_client", error_description: "Client Authentication failed" },
        { "paypal-debug-id": "debug-oauth" },
      ),
    );

    expect(error).toMatchObject({
      status: 401,
      paypalName: "invalid_client",
      message: "Client Authentication failed",
      debugId: "debug-oauth",
      details: [],
      issue: null,
    });
  });

  it("handles a non-JSON error body", async () => {
    const error = await errorFor(
      new Response("<html>Service Unavailable</html>", {
        status: 503,
        headers: { "paypal-debug-id": "debug-503" },
      }),
    );

    expect(error).toBeInstanceOf(PaypalError);
    expect(error).toMatchObject({ status: 503, debugId: "debug-503", details: [] });
    expect((error as PaypalError).message).toContain("503");
  });

  it("falls back to the paypal-debug-id header", async () => {
    const error = await errorFor(
      jsonResponse(
        400,
        { name: "INVALID_REQUEST", message: "Request is not well-formed." },
        { "paypal-debug-id": "debug-header" },
      ),
    );

    expect(error).toMatchObject({ paypalName: "INVALID_REQUEST", debugId: "debug-header" });
  });
});

describe("exchangeAuthorizationCode", () => {
  it("exchanges the code with Basic auth and leaves the app token cache alone", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "user-token", expires_in: 28800 }))
      .mockResolvedValueOnce(tokenResponse("app-token"));

    await expect(exchangeAuthorizationCode("code/with+chars")).resolves.toEqual({
      accessToken: "user-token",
    });

    const { url, init, headers } = callAt(0);
    expect(url).toBe("https://api-m.sandbox.paypal.com/v1/oauth2/token");
    expect(headers.get("authorization")).toBe(BASIC_AUTH);
    expect(init.body).toBe("grant_type=authorization_code&code=code%2Fwith%2Bchars");

    expect(await getAppAccessToken()).toBe("app-token");
    expect(callAt(1).init.body).toBe("grant_type=client_credentials");
  });

  it("throws PaypalError when PayPal rejects the code", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: "invalid_grant", error_description: "Invalid authorization code" }),
    );

    await expect(exchangeAuthorizationCode("bad")).rejects.toMatchObject({
      status: 400,
      paypalName: "invalid_grant",
    });
  });

  it("throws PaypalConfigError when credentials are missing", async () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "");
    await expect(exchangeAuthorizationCode("code")).rejects.toBeInstanceOf(PaypalConfigError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchUserInfo", () => {
  it("reads userinfo with the user's token", async () => {
    const info = {
      payer_id: "PAYER-1",
      emails: [{ value: "pp@example.com", primary: true, confirmed: true }],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, info));

    await expect(fetchUserInfo("user-token")).resolves.toEqual(info);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const { url, init, headers } = callAt(0);
    expect(url).toBe(
      "https://api-m.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1",
    );
    expect(init.method ?? "GET").toBe("GET");
    expect(headers.get("authorization")).toBe("Bearer user-token");
  });
});
