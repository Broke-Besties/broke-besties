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
  },
}));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { PaypalConfigError } from "@/lib/paypal-errors";
import { paypalService } from "@/services/paypal.service";
import { GET as connectRoute } from "@/app/api/paypal/connect/route";
import { GET as callbackRoute } from "@/app/api/paypal/callback/route";
import { DELETE as disconnectRoute, GET as getAccountRoute } from "@/app/api/paypal/account/route";
import { BORROWER_ID } from "../../test/mocks";

function signIn() {
  vi.mocked(getUser).mockResolvedValue({ id: BORROWER_ID } as never);
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
