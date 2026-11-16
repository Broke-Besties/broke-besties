import { describe, expect, it } from "vitest";
import {
  createOpaqueToken,
  hashToken,
  pkceChallenge,
  signAccessToken,
  verifyAccessToken,
} from "./tokens";

const SECRET = "test-secret-0123456789abcdef";
const NOW = 1_700_000_000;

const claims = {
  sub: "user-1",
  email: "u@example.com",
  aud: "broke-besties-mcp",
  iss: "http://localhost:8082",
};

describe("access tokens", () => {
  it("round-trips through sign/verify", () => {
    const token = signAccessToken(claims, SECRET, 3600, NOW);
    const verified = verifyAccessToken(token, SECRET, { now: NOW + 60 });
    expect(verified).toMatchObject({
      sub: "user-1",
      email: "u@example.com",
      aud: "broke-besties-mcp",
      iss: "http://localhost:8082",
    });
    expect(verified?.iat).toBe(NOW);
    expect(verified?.exp).toBe(NOW + 3600);
  });

  it("rejects expired tokens", () => {
    const token = signAccessToken(claims, SECRET, 3600, NOW);
    expect(verifyAccessToken(token, SECRET, { now: NOW + 3601 })).toBeNull();
  });

  it("rejects the wrong secret", () => {
    const token = signAccessToken(claims, "other-secret", 3600, NOW);
    expect(verifyAccessToken(token, SECRET, { now: NOW })).toBeNull();
  });

  it("rejects tampered payloads", () => {
    const token = signAccessToken(claims, SECRET, 3600, NOW);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...claims, sub: "attacker" }),
    ).toString("base64url");
    expect(
      verifyAccessToken(`${header}.${forgedPayload}.${signature}`, SECRET, {
        now: NOW,
      }),
    ).toBeNull();
  });

  it("rejects garbage and wrong alg headers", () => {
    expect(verifyAccessToken("garbage", SECRET, { now: NOW })).toBeNull();
    const token = signAccessToken(claims, SECRET, 3600, NOW);
    const [header, payload, signature] = token.split(".");
    const noneHeader = Buffer.from(
      JSON.stringify({ alg: "none", typ: "JWT" }),
    ).toString("base64url");
    expect(
      verifyAccessToken(`${noneHeader}.${payload}.${signature}`, SECRET, { now: NOW }),
    ).toBeNull();
    expect(verifyAccessToken(`${header}.${payload}${signature}`, SECRET, { now: NOW })).toBeNull();
  });

  it("honors issuer and audience checks", () => {
    const token = signAccessToken(claims, SECRET, 3600, NOW);
    expect(verifyAccessToken(token, SECRET, { now: NOW, issuer: "http://other" })).toBeNull();
    expect(verifyAccessToken(token, SECRET, { now: NOW, audience: "other-aud" })).toBeNull();
    expect(
      verifyAccessToken(token, SECRET, {
        now: NOW,
        issuer: claims.iss,
        audience: claims.aud,
      }),
    ).not.toBeNull();
  });
});

describe("opaque tokens", () => {
  it("generate distinct non-recordable values and hash deterministically", () => {
    const a = createOpaqueToken();
    const b = createOpaqueToken();
    expect(a).not.toBe(b);
    expect(hashToken(a)).toBe(hashToken(a));
    expect(hashToken(a)).not.toBe(hashToken(b));
  });
});

describe("PKCE", () => {
  it("matches the RFC 7636 appendix B test vector", () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    expect(pkceChallenge(verifier)).toBe(
      "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    );
  });
});
