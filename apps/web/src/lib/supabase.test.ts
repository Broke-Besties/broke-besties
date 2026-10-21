import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
  createJsClient: vi.fn(),
  createServerClient: vi.fn(),
  verifierGetUser: vi.fn(),
  cookieGetUser: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
  cookies: mocks.cookies,
}));
vi.mock("@supabase/supabase-js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@supabase/supabase-js")>()),
  createClient: mocks.createJsClient,
}));

import { AuthRetryableFetchError } from "@supabase/supabase-js";
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

const bearerUser = { id: "user-bearer", email: "mobile@example.com" };
const cookieUser = { id: "user-cookie", email: "web@example.com" };

function requestHeaders(init?: HeadersInit) {
  mocks.headers.mockResolvedValue(new Headers(init));
}

// The token verifier is memoized at module level, so each test loads a fresh copy.
async function loadGetUser() {
  vi.resetModules();
  const { getUser } = await import("@/lib/supabase");
  return getUser;
}

describe("getUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");

    mocks.createJsClient.mockReturnValue({
      auth: { getUser: mocks.verifierGetUser },
    });
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: mocks.cookieGetUser },
    });
    mocks.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() });
    mocks.verifierGetUser.mockResolvedValue({
      data: { user: bearerUser },
      error: null,
    });
    mocks.cookieGetUser.mockResolvedValue({
      data: { user: cookieUser },
      error: null,
    });
  });

  it("verifies a Bearer token with a stateless client and never touches cookies", async () => {
    requestHeaders({ authorization: "Bearer good-token" });
    const getUser = await loadGetUser();

    await expect(getUser()).resolves.toEqual(bearerUser);

    expect(mocks.verifierGetUser).toHaveBeenCalledWith("good-token");
    expect(mocks.createJsClient).toHaveBeenCalledWith(
      "https://project.supabase.co",
      "anon-key",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("returns null for an invalid or expired token without falling back to cookies", async () => {
    requestHeaders({ authorization: "Bearer expired-token" });
    mocks.verifierGetUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: new Error("invalid JWT: token is expired"),
      })
      .mockResolvedValueOnce({ data: { user: null }, error: null });
    const getUser = await loadGetUser();

    await expect(getUser()).resolves.toBeNull();
    await expect(getUser()).resolves.toBeNull();

    expect(mocks.cookies).not.toHaveBeenCalled();
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.cookieGetUser).not.toHaveBeenCalled();
  });

  it("throws when Supabase can't be reached, so an outage isn't reported as a bad token", async () => {
    requestHeaders({ authorization: "Bearer good-token" });
    mocks.verifierGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new AuthRetryableFetchError("fetch failed", 0),
    });
    const getUser = await loadGetUser();

    await expect(getUser()).rejects.toThrow("fetch failed");
    expect(mocks.cookies).not.toHaveBeenCalled();
  });

  it("uses the cookie session when there is no Authorization header", async () => {
    requestHeaders();
    const getUser = await loadGetUser();

    await expect(getUser()).resolves.toEqual(cookieUser);

    expect(mocks.createServerClient).toHaveBeenCalledTimes(1);
    expect(mocks.cookieGetUser).toHaveBeenCalledTimes(1);
    expect(mocks.createJsClient).not.toHaveBeenCalled();
  });

  it("still returns null when the cookie session is missing", async () => {
    requestHeaders();
    mocks.cookieGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: new Error("Auth session missing!"),
    });
    const getUser = await loadGetUser();

    await expect(getUser()).resolves.toBeNull();
  });

  it("accepts a lowercase bearer scheme", async () => {
    requestHeaders({ authorization: "bearer lower-token" });
    const getUser = await loadGetUser();

    await expect(getUser()).resolves.toEqual(bearerUser);

    expect(mocks.verifierGetUser).toHaveBeenCalledWith("lower-token");
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it("ignores other authorization schemes", async () => {
    requestHeaders({ authorization: "Basic dXNlcjpwYXNz" });
    const getUser = await loadGetUser();

    await expect(getUser()).resolves.toEqual(cookieUser);

    expect(mocks.verifierGetUser).not.toHaveBeenCalled();
  });

  it("falls back to cookies when the bearer token is empty", async () => {
    // Fetch Headers strip the trailing space; the plain object keeps it, so both
    // the "no token after the scheme" and the "whitespace-only token" paths run.
    mocks.headers
      .mockResolvedValueOnce(new Headers({ authorization: "Bearer " }))
      .mockResolvedValueOnce({
        get: (name: string) => (name === "authorization" ? "Bearer   " : null),
      });
    const getUser = await loadGetUser();

    await expect(getUser()).resolves.toEqual(cookieUser);
    await expect(getUser()).resolves.toEqual(cookieUser);

    expect(mocks.createJsClient).not.toHaveBeenCalled();
    expect(mocks.verifierGetUser).not.toHaveBeenCalled();
    expect(mocks.cookieGetUser).toHaveBeenCalledTimes(2);
  });

  it("falls back to cookies when headers() throws outside a request scope", async () => {
    mocks.headers.mockImplementation(() => {
      throw new Error("`headers` was called outside a request scope");
    });
    const getUser = await loadGetUser();

    await expect(getUser()).resolves.toEqual(cookieUser);

    expect(mocks.createJsClient).not.toHaveBeenCalled();
  });

  it("creates the token verifier lazily and only once", async () => {
    requestHeaders({ authorization: "Bearer good-token" });
    const getUser = await loadGetUser();

    expect(mocks.createJsClient).not.toHaveBeenCalled();

    await getUser();
    await getUser();

    expect(mocks.createJsClient).toHaveBeenCalledTimes(1);
    expect(mocks.verifierGetUser).toHaveBeenCalledTimes(2);
  });
});
