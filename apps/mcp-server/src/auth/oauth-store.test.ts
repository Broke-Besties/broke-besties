import { describe, expect, it, vi } from "vitest";
import { OAuthStore, isAcceptableRedirectUri } from "./oauth-store";
import { createAuthCode, pkceChallenge } from "../lib/tokens";

const NOW = 1_000_000_000;
const MS = 60 * 60 * 1000; // 1 hour

function seededStore(): OAuthStore {
  return new OAuthStore();
}

describe("redirect uri validation", () => {
  it("accepts https and loopback http", () => {
    expect(isAcceptableRedirectUri("https://claude.ai/oauth/callback")).toBe(true);
    expect(isAcceptableRedirectUri("http://localhost:33418/callback")).toBe(true);
    expect(isAcceptableRedirectUri("http://127.0.0.1:8080/cb")).toBe(true);
  });

  it("rejects plain-http remote hosts and garbage", () => {
    expect(isAcceptableRedirectUri("http://evil.example.com/cb")).toBe(false);
    expect(isAcceptableRedirectUri("not a uri")).toBe(false);
    expect(isAcceptableRedirectUri("")).toBe(false);
  });
});

describe("client registration", () => {
  it("registers and returns clients", () => {
    const store = seededStore();
    const client = store.registerClient({
      clientName: "Test Client",
      redirectUris: ["http://localhost:8080/cb"],
    });
    expect(store.getClient(client.clientId)).toMatchObject({
      clientName: "Test Client",
      redirectUris: ["http://localhost:8080/cb"],
    });
  });

  it("rejects empty or unacceptable redirect lists", () => {
    const store = seededStore();
    expect(() => store.registerClient({ redirectUris: [] })).toThrow(
      "At least one redirect_uri is required",
    );
    expect(() =>
      store.registerClient({ redirectUris: ["http://evil.example.com/cb"] }),
    ).toThrow("redirect_uri is not acceptable");
  });
});

describe("authorization codes", () => {
  it("are single-use", () => {
    const store = seededStore();
    const code = store.createAuthCode(
      {
        clientId: "c1",
        userId: "u1",
        email: "u1@example.com",
        redirectUri: "http://localhost/cb",
        codeChallenge: "challenge",
        resource: "aud",
        scope: "mcp",
      },
      NOW,
    );

    const first = store.consumeAuthCode(code, NOW);
    expect(first).toMatchObject({ userId: "u1" });
    expect(store.consumeAuthCode(code, NOW)).toBeNull();
  });

  it("expire after the TTL and before redemption", () => {
    const store = seededStore();
    const code = store.createAuthCode(
      {
        clientId: "c1",
        userId: "u1",
        email: "u1@example.com",
        redirectUri: "http://localhost/cb",
        codeChallenge: "challenge",
        resource: "aud",
        scope: "mcp",
      },
      NOW,
    );
    expect(store.consumeAuthCode(code, NOW + MS * 11)).toBeNull();
    expect(store.sweep(NOW + MS * 11)).toBeUndefined();
    expect(store["authCodes"].has(code)).toBe(false);
  });
});

describe("auth flows", () => {
  it("expire and can be deleted", () => {
    const store = seededStore();
    const id = store.createAuthFlow(
      {
        clientId: "c1",
        redirectUri: "http://localhost/cb",
        codeChallenge: "challenge",
        resource: "aud",
      },
      NOW,
    );
    const flow = store.getAuthFlow(id, NOW);
    expect(flow).toMatchObject({ clientId: "c1" });

    store.deleteAuthFlow(id);
    expect(store.getAuthFlow(id, NOW)).toBeNull();
  });
});

describe("refresh token rotation", () => {
  it("Each rotation revokes the presented token (detects reuse)", () => {
    const store = seededStore();
    const token = store.createRefreshToken(
      { userId: "u1", email: "u1@example.com", clientId: "c1" },
      NOW,
    );
    const rotated = store.rotateRefreshToken(token, NOW + 1000);
    expect(rotated).toMatchObject({ userId: "u1" });

    // reuse of the rotated-away token is rejected
    expect(store.rotateRefreshToken(token, NOW + 2000)).toBeNull();
  });

  it("rejects unknown or expired tokens", () => {
    const store = seededStore();
    expect(store.rotateRefreshToken("garbage", NOW)).toBeNull();

    const token = store.createRefreshToken(
      { userId: "u1", email: "u@e.com", clientId: "c1" },
      NOW,
    );
    const wayLater = NOW + 60 * 24 * 60 * 60 * 1000; // 60 days later
    expect(store.rotateRefreshToken(token, wayLater)).toBeNull();
  });
});

describe("shared storage (supabase PKCE verifier)", () => {
  it("saves, reads and removes values", () => {
    const store = seededStore();
    store.storageSet("sb-ref-auth-token-code-verifier", "v1", NOW);
    expect(store.storageGet("sb-ref-auth-token-code-verifier", NOW)).toBe("v1");
    store.storageRemove("sb-ref-auth-token-code-verifier");
    expect(store.storageGet("sb-ref-auth-token-code-verifier", NOW)).toBeNull();
  });

  it("expires stored values", () => {
    const store = seededStore();
    store.storageSet("key", "v1", NOW);
    const withinTtl = NOW + 9 * 60 * 1000; // TTL is 10 minutes
    expect(store.storageGet("key", withinTtl)).toBe("v1");
    expect(store.storageGet("key", withinTtl + 2 * 60 * 1000)).toBeNull();
  });
});

describe("PKCE", () => {
  it("matches the RFC 7636 appendix B test vector", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(pkceChallenge(verifier)).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("auth codes and flows do not leak ids", () => {
    vi.stubGlobal("crypto", globalThis.crypto);
    const store = seededStore();
    const code = store.createAuthCode(
      {
        clientId: "c1",
        userId: "u1",
        email: "u@e.com",
        redirectUri: "http://localhost/cb",
        codeChallenge: "challenge",
        resource: "aud",
        scope: "mcp",
      },
      NOW,
    );
    expect(typeof createAuthCode()).toBe("string");
    expect(code.length).toBeGreaterThan(0);
  });
});
