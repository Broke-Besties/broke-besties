import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface AccessTokenClaims {
  sub: string;
  email: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

export type SignableClaims = Omit<AccessTokenClaims, "iat" | "exp">;

function base64Url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function signAccessToken(
  claims: SignableClaims,
  secret: string,
  ttlSeconds: number,
  now = Math.floor(Date.now() / 1000),
): string {
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({ ...claims, iat: now, exp: now + ttlSeconds }),
  );
  const signature = base64Url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

export interface VerifyOptions {
  issuer?: string;
  audience?: string;
  now?: number;
}

export function verifyAccessToken(
  token: string,
  secret: string,
  options: VerifyOptions = {},
): AccessTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; typ?: string };
  let claims: AccessTokenClaims;
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString());
    claims = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
  } catch {
    return null;
  }

  if (header.alg !== "HS256" || header.typ !== "JWT") return null;

  const expected = base64Url(
    createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest(),
  );
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureB64);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) return null;
  if (options.issuer && claims.iss !== options.issuer) return null;
  if (options.audience && claims.aud !== options.audience) return null;
  if (typeof claims.sub !== "string" || claims.sub.length === 0) return null;

  return claims;
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function createAuthCode(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** PKCE challenge from a plaintext verifier (S256). */
export function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}
