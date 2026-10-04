import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PaypalConfigError, PaypalError, type PaypalErrorDetail } from "@/lib/paypal-errors";

// PayPal REST API helpers: plain fetch, no SDK. Server-only (uses the client secret).

const TIMEOUT_MS = 30_000;
const STATE_TTL_MS = 10 * 60 * 1000;

export type PaypalEnv = "sandbox" | "live";

export function paypalEnv(): PaypalEnv {
  return process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
}

export function paypalBase(): string {
  return paypalEnv() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export function paypalWebBase(): string {
  return paypalEnv() === "live" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com";
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new PaypalConfigError(`${name} is not set`);
  return value;
}

export function getPaypalCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: requireEnv("PAYPAL_CLIENT_ID"),
    clientSecret: requireEnv("PAYPAL_CLIENT_SECRET"),
  };
}

export function getAppUrl(): string {
  return requireEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
}

export function getStateSecret(): string {
  const secret = requireEnv("PAYPAL_STATE_SECRET");
  if (secret.length < 32) {
    throw new PaypalConfigError("PAYPAL_STATE_SECRET must be at least 32 characters");
  }
  return secret;
}

export function getWebhookId(): string {
  return requireEnv("PAYPAL_WEBHOOK_ID");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function toPaypalError(response: Response, text: string): PaypalError {
  const parsed = parseJson(text);
  const body = (parsed && typeof parsed === "object" ? parsed : {}) as Record<string, unknown>;
  const str = (value: unknown) => (typeof value === "string" && value ? value : undefined);
  const details = Array.isArray(body.details)
    ? body.details.filter((d): d is PaypalErrorDetail => !!d && typeof d === "object")
    : [];
  return new PaypalError(
    response.status,
    // Orders/Payments errors use { name, message, debug_id }; OAuth errors { error, error_description }.
    str(body.name) ?? str(body.error) ?? "UNKNOWN_ERROR",
    str(body.message) ?? str(body.error_description) ?? `PayPal request failed with HTTP ${response.status}`,
    str(body.debug_id) ?? response.headers.get("paypal-debug-id"),
    details,
  );
}

/** Body of a 2xx response as JSON (null when empty); a non-2xx response throws PaypalError. */
async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw toPaypalError(response, text);
  return text ? JSON.parse(text) : null;
}

async function requestToken(form: string): Promise<{ access_token: string; expires_in?: unknown }> {
  const { clientId, clientSecret } = getPaypalCredentials();
  const response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await readResponse(response)) as { access_token?: unknown; expires_in?: unknown } | null;
  if (typeof data?.access_token !== "string" || !data.access_token) {
    throw new Error("PayPal token response has no access_token");
  }
  return { access_token: data.access_token, expires_in: data.expires_in };
}

// ponytail: in-memory cache per server instance, and concurrent cold-cache callers each fetch
// their own token (harmless). Move it to a shared store if PayPal starts throttling token calls.
let tokenCache: { key: string; token: string; expiresAt: number } | null = null;

/** Client-credentials token for our REST app, cached until 60 s before it expires. */
export async function getAppAccessToken(): Promise<string> {
  const key = `${paypalEnv()}:${getPaypalCredentials().clientId}`;
  if (tokenCache?.key === key && Date.now() < tokenCache.expiresAt) return tokenCache.token;

  const { access_token, expires_in } = await requestToken("grant_type=client_credentials");
  tokenCache = { key, token: access_token, expiresAt: Date.now() + (Number(expires_in) - 60) * 1000 };
  return access_token;
}

/** Test-only: forget the cached app token. */
export function resetPaypalTokenCacheForTests(): void {
  tokenCache = null;
}

export type PaypalFetchInit = Omit<RequestInit, "headers" | "signal"> & {
  headers?: Record<string, string>;
  /** Sent as PayPal-Request-Id, which makes POSTs idempotent. */
  requestId?: string;
  /** A user's token (Log in with PayPal) instead of the app token. */
  accessToken?: string;
};

/**
 * Calls the PayPal REST API and returns the JSON body. Throws PaypalError for a non-2xx answer;
 * network errors, timeouts and unreadable bodies are rethrown as they are (outcome unknown).
 */
export async function paypalFetch<T = unknown>(path: string, init: PaypalFetchInit = {}): Promise<T> {
  const { requestId, accessToken, headers, ...rest } = init;
  const send = (token: string) =>
    fetch(`${paypalBase()}${path}`, {
      ...rest,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(requestId ? { "PayPal-Request-Id": requestId } : {}),
        ...headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let response = await send(accessToken ?? (await getAppAccessToken()));
  if (response.status === 401 && !accessToken) {
    // The cached app token was revoked or expired early: retry once with a fresh one.
    tokenCache = null;
    response = await send(await getAppAccessToken());
  }
  return (await readResponse(response)) as T;
}

/** Log in with PayPal: trades the authorization code for the user's access token. */
export async function exchangeAuthorizationCode(code: string): Promise<{ accessToken: string }> {
  const form = new URLSearchParams({ grant_type: "authorization_code", code }).toString();
  return { accessToken: (await requestToken(form)).access_token };
}

export type PaypalUserInfo = {
  payer_id?: string;
  email?: string;
  email_verified?: boolean | string;
  emails?: { value?: string; primary?: boolean | string; confirmed?: boolean | string }[];
};

export async function fetchUserInfo(accessToken: string): Promise<PaypalUserInfo> {
  const info = await paypalFetch<PaypalUserInfo | null>(
    "/v1/identity/oauth2/userinfo?schema=paypalv1.1",
    { accessToken },
  );
  return info ?? {};
}

function stateSignature(encodedPayload: string): string {
  return createHmac("sha256", getStateSecret()).update(encodedPayload).digest("base64url");
}

/** OAuth `state`: base64url JSON payload + HMAC-SHA256, expiring after 10 minutes. */
export function signState(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(
    JSON.stringify({
      ...payload,
      exp: Date.now() + STATE_TTL_MS,
      nonce: randomBytes(16).toString("base64url"),
    }),
  ).toString("base64url");
  return `${encoded}.${stateSignature(encoded)}`;
}

/** The signed payload, or null when the state is tampered, expired or malformed. */
export function verifyState(
  state: string | null | undefined,
): (Record<string, unknown> & { exp: number }) | null {
  const [encoded = "", signature = "", ...extra] = (state ?? "").split(".");
  const expected = Buffer.from(stateSignature(encoded));
  const actual = Buffer.from(signature);
  if (!encoded || extra.length > 0 || actual.length !== expected.length) return null;
  if (!timingSafeEqual(actual, expected)) return null;

  const payload = decodeStateUnverified(state);
  if (typeof payload?.exp !== "number" || payload.exp <= Date.now()) return null;
  return payload as Record<string, unknown> & { exp: number };
}

/**
 * The payload WITHOUT checking the signature. Only for choosing where an error redirect goes,
 * and only together with an allow-list (isAppScheme).
 */
export function decodeStateUnverified(state: string | null | undefined): Record<string, unknown> | null {
  const payload = parseJson(Buffer.from((state ?? "").split(".")[0], "base64url").toString("utf8"));
  return payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}

export const APP_SCHEMES = ["brokebesties", "brokebesties-preview", "brokebesties-dev"] as const;
export type AppScheme = (typeof APP_SCHEMES)[number];

/** App scheme for the X-App-Variant header the iOS app sends. */
export function schemeForVariant(variant: string | null | undefined): AppScheme {
  if (variant === "development") return "brokebesties-dev";
  if (variant === "preview") return "brokebesties-preview";
  return "brokebesties";
}

export function isAppScheme(value: unknown): value is AppScheme {
  return (APP_SCHEMES as readonly unknown[]).includes(value);
}

/**
 * Approve (checkout) page for an order.
 * ponytail: rebuilt from the order id because we don't store PayPal's payer-action link; this is
 * the URL PayPal returns there. Store the link on the payment if PayPal ever changes its format.
 */
export function checkoutUrl(orderId: string): string {
  return `${paypalWebBase()}/checkoutnow?token=${encodeURIComponent(orderId)}`;
}

/** Exact cents for a PayPal decimal string ("42.50" → 4250); null if malformed or sub-cent. */
export function amountToCents(value: unknown): number | null {
  const match = typeof value === "string" ? /^(\d+)(?:\.(\d+))?$/.exec(value) : null;
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  if (/[1-9]/.test(fraction.slice(2))) return null;
  const cents = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** PayPal decimal string for cents (4250 → "42.50"). */
export function centsToAmount(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError(`Invalid amount in cents: ${cents}`);
  }
  const remainder = cents % 100;
  return `${(cents - remainder) / 100}.${String(remainder).padStart(2, "0")}`;
}
