import { createHash, createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("./lib/prisma", async () => {
  const { createMockPrisma } = await import("./test/mocks");
  return { prisma: createMockPrisma() };
});

const SECRET = "integration-test-secret";

(process.env as { MCP_JWT_SECRET?: string }).MCP_JWT_SECRET = SECRET;

import { createApp, getStore } from "./index";
import { createOpaqueToken, pkceChallenge } from "./lib/tokens";

let server: import("node:http").Server;
let baseUrl: string;

beforeAll(async () => {
  server = createApp();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function postToken(form: Record<string, string>): Promise<Response> {
  return fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
  });
}

describe("oauth endpoints", () => {
  it("challenges unauthenticated /mcp calls with OAuth discovery", async () => {
    const response = await fetch(`${baseUrl}/mcp`, { method: "POST" });
    expect(response.status).toBe(401);
    const challenge = response.headers.get("www-authenticate");
    expect(challenge).toContain("Bearer");
    expect(challenge).toContain("resource_metadata=");
    expect(challenge).toContain("/.well-known/oauth-protected-resource");
  });

  it("serves discovery metadata", async () => {
    const [authServer, protectedResource] = await Promise.all([
      fetch(`${baseUrl}/.well-known/oauth-authorization-server`),
      fetch(`${baseUrl}/.well-known/oauth-protected-resource`),
    ]);
    const metadata = (await authServer.json()) as Record<string, unknown>;
    expect(metadata).toMatchObject({
      issuer: expect.any(String),
      authorization_endpoint: expect.stringContaining("/authorize"),
      token_endpoint: expect.stringContaining("/token"),
      registration_endpoint: expect.stringContaining("/register"),
      code_challenge_methods_supported: ["S256"],
    });
    const resourceDoc = (await protectedResource.json()) as { authorization_servers?: string[] };
    expect(resourceDoc.authorization_servers).toEqual([metadata.issuer]);
  });

  it("registers a client with loopback redirects", async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Integration Test",
        redirect_uris: ["http://localhost:33418/callback"],
      }),
    });
    expect(response.status).toBe(201);
    const client = (await response.json()) as { client_id: string; token_endpoint_auth_method: string };
    expect(client.token_endpoint_auth_method).toBe("none");
    expect(store.getClient(client.client_id)).toMatchObject({
      clientName: "Integration Test",
    });
  });

  it("rejects registration with a remote http redirect", async () => {
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://evil.example.com/callback"],
      }),
    });
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: string }).error).toBe("invalid_redirect_uri");
  });

  describe("token grant", () => {
    let verifier: string;
    let clientId: string;
    let code: string;

    beforeAll(() => {
      // inject an auth code as if /authorize -> supabase -> /callback ran
      verifier = createOpaqueToken();
      const client = store.registerClient({
        clientName: "pkce",
        redirectUris: ["http://localhost:8080/cb"],
      });
      clientId = client.clientId;
      code = store.createAuthCode({
        clientId,
        userId: "user-1",
        email: "u@example.com",
        redirectUri: "http://localhost:8080/cb",
        codeChallenge: pkceChallenge(verifier),
        resource: "broke-besties-mcp",
        scope: "mcp",
      });
    });

    it("rejects a wrong PKCE verifier (with its own code)", async () => {
      const otherVerifier = createOpaqueToken();
      const otherCode = store.createAuthCode({
        clientId,
        userId: "user-1",
        email: "u@example.com",
        redirectUri: "http://localhost:8080/cb",
        codeChallenge: pkceChallenge(otherVerifier),
        resource: "broke-besties-mcp",
        scope: "mcp",
      });
      const response = await postToken({
        grant_type: "authorization_code",
        code: otherCode,
        client_id: clientId,
        redirect_uri: "http://localhost:8080/cb",
        code_verifier: "wrong-verifier-wrong-verifier-wrong-verifier-43",
      });
      expect(response.status).toBe(400);
      expect(((await response.json()) as { error: string }).error).toBe("invalid_grant");
    });

    it("issues tokens for a valid PKCE exchange", async () => {
      const response = await postToken({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: "http://localhost:8080/cb",
        code_verifier: verifier,
      });
      expect(response.status).toBe(200);
      const body = (await response.json()) as { token_type: string; access_token: string; refresh_token: string };

      expect(body.token_type).toBe("Bearer");
      const claims = verify(body.access_token);
      expect(claims.sub).toBe("user-1");

      // refresh flow + rotation
      const refreshed = await postToken({
        grant_type: "refresh_token",
        refresh_token: body.refresh_token,
      });
      expect(refreshed.status).toBe(200);
      expect(
        verify(((await refreshed.json()) as { access_token: string }).access_token).sub,
      ).toBe("user-1");

      // reuse of the rotated-away refresh token fails
      const reused = await postToken({
        grant_type: "refresh_token",
        refresh_token: body.refresh_token,
      });
      expect(reused.status).toBe(400);
      expect(((await reused.json()) as { error: string }).error).toBe("invalid_grant");
    });

    it("enforces single-use authorization codes", async () => {
      const replayed = await postToken({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: "http://localhost:8080/cb",
        code_verifier: verifier,
      });
      expect(replayed.status).toBe(400);
      expect(((await replayed.json()) as { error: string }).error).toBe("invalid_grant");
    });
  });

  function verify(token: string): { sub: string } {
    const [header, payload, signature] = token.split(".");
    const expected = Buffer.from(
      createHmac("sha256", SECRET).update(`${header}.${payload}`).digest(),
    ).toString("base64url");
    expect(signature).toBe(expected);
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    // signature + sub are what matters here; iss/aud/expiry live in tokens.test.ts
    expect(claims.aud).toBe("broke-besties-mcp");
    return { sub: String(claims.sub) };
  }
});

const store = getStore();
