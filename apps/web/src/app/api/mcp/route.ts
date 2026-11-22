import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticateMcpRequest } from "@/mcp/auth";
import { createBrokeBestiesMcpServer } from "@/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WARMUP_INITIALIZE = {
  jsonrpc: "2.0",
  id: "__broke_besties_warmup__",
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "broke-besties", version: "1.0.0" },
  },
};

function unauthorized() {
  return Response.json(
    { error: "Missing or invalid MCP credential" },
    { status: 401, headers: { "www-authenticate": "Bearer" } },
  );
}

function isInitialize(body: unknown) {
  const messages = Array.isArray(body) ? body : [body];
  return messages.some(
    (message) =>
      message &&
      typeof message === "object" &&
      (message as { method?: unknown }).method === "initialize",
  );
}

/**
 * Stateless Streamable HTTP endpoint. Each request gets a fresh server scoped
 * to the credential's user. For non-initialize requests we replay the MCP
 * initialization handshake on the new transport (with its own transient
 * session id) so the request can be handled independently. This keeps the
 * endpoint working on serverless hosts where in-memory sessions cannot survive
 * between invocations.
 */
export async function POST(request: NextRequest) {
  const auth = await authenticateMcpRequest(request);
  if (!auth) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const server = createBrokeBestiesMcpServer({ userId: auth.userId });
  let sessionId: string | undefined;
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => {
      sessionId = randomUUID();
      return sessionId;
    },
    enableJsonResponse: true,
  });
  await server.connect(transport);

  const authInfo = {
    token: auth.token,
    clientId: auth.userId,
    scopes: ["broke-besties"],
  };

  try {
    if (!isInitialize(body)) {
      const protocolVersion =
        request.headers.get("mcp-protocol-version") ??
        WARMUP_INITIALIZE.params.protocolVersion;
      const warmupResponse = await transport.handleRequest(
        new Request("http://localhost/api/mcp", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
          },
          body: JSON.stringify({
            ...WARMUP_INITIALIZE,
            params: {
              ...WARMUP_INITIALIZE.params,
              protocolVersion,
            },
          }),
        }),
      );
      await warmupResponse.text();

      const headers = new Headers(request.headers);
      if (sessionId) headers.set("mcp-session-id", sessionId);
      const replay = new Request(request.url, {
        method: "POST",
        headers,
      });

      return await transport.handleRequest(replay, {
        parsedBody: body,
        authInfo,
      });
    }

    const headers = new Headers(request.headers);
    const replay = new Request(request.url, { method: "POST", headers });
    return await transport.handleRequest(replay, {
      parsedBody: body,
      authInfo,
    });
  } finally {
    await server.close().catch(() => {});
  }
}

export function GET() {
  return Response.json(
    { error: "Use POST for the Broke Besties MCP endpoint" },
    { status: 405, headers: { allow: "POST, DELETE" } },
  );
}

export function DELETE() {
  return new Response(null, { status: 204 });
}

