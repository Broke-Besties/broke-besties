import { IncomingMessage, Server, ServerResponse } from "node:http";
import { config } from "./config";
import { authenticate, bearerChallengeHeaders } from "./auth/bearer";
import {
  isAcceptableRedirectUri,
  OAuthStore,
  startSweeper,
} from "./auth/oauth-store";
import { exchangeSupabaseCode, startAuthFlow } from "./auth/supabase-auth";
import { ACCESS_TOKEN_TTL_SECONDS } from "./config";
import {
  HttpError,
  readFormBody,
  readJsonBody,
  redirect,
  sendHtml,
  sendJson,
  withCors,
} from "./lib/http";
import { pkceChallenge, signAccessToken } from "./lib/tokens";
import { handleMcpPost } from "./mcp/server";
import { packageVersion } from "./version";

const store = new OAuthStore();

const ERROR_PAGE = (message: string) =>
  `<!doctype html><html><body><h1>Authorization error</h1><p>${message}</p></body></html>`;

function authorizationServerMetadata(baseUrl: string) {
  return {
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: [config.scope],
  };
}

function protectedResourceMetadata(baseUrl: string) {
  return {
    resource: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: [config.scope],
    bearer_methods_supported: ["header"],
  };
}

export async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const route = `${req.method} ${url.pathname}`;
  const corsHeaders = withCors();

  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    switch (route) {
      case "POST /mcp":
        return await handleMcp(req, res);
      case "GET /mcp":
        return sendJson(
          res,
          405,
          { error: "method_not_allowed" },
          { allow: "POST", ...corsHeaders },
        );
      case "POST /register":
        return await handleRegister(req, res);
      case "GET /.well-known/oauth-authorization-server":
        return sendJson(
          res,
          200,
          authorizationServerMetadata(config.baseUrl),
          corsHeaders,
        );
      case "GET /.well-known/oauth-protected-resource":
        return sendJson(
          res,
          200,
          protectedResourceMetadata(config.baseUrl),
          corsHeaders,
        );
      case "GET /authorize":
        return await handleAuthorize(res, url);
      case "GET /callback":
        return await handleCallback(res, url);
      case "POST /token":
        return await handleToken(res, req);
      case "GET /health":
        return sendJson(res, 200, { status: "ok", version: packageVersion }, corsHeaders);
      default:
        return sendJson(res, 404, { error: "not_found" }, corsHeaders);
    }
  } catch (error) {
    if (error instanceof HttpError) {
      const headers = error.status === 401 ? bearerChallengeHeaders() : corsHeaders;
      sendJson(
        res,
        error.status,
        { error: error.code ?? "error", message: error.message },
        headers,
      );
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(res, 400, { error: "invalid_request", message: "Malformed request body" }, corsHeaders);
      return;
    }
    if (!res.headersSent) {
      sendJson(res, 500, { error: "internal_error" }, corsHeaders);
    } else {
      res.end();
    }
  }
}

async function handleMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let ctx;
  try {
    ctx = authenticate(req);
  } catch (error) {
    const isMissingHeader = error instanceof Error && !(error instanceof HttpError);
    sendJson(
      res,
      401,
      { error: "unauthorized" },
      withCors(
        bearerChallengeHeaders(isMissingHeader ? "invalid_request" : "invalid_token"),
      ),
    );
    return;
  }
  await handleMcpPost(req, res, ctx);
}

function requireString(params: URLSearchParams, key: string): string {
  const value = params.get(key);
  if (!value) {
    throw new HttpError(400, `Missing required parameter: ${key}`, "invalid_request");
  }
  return value;
}

async function handleAuthorize(res: ServerResponse, url: URL): Promise<void> {
  const params = url.searchParams;

  const responseType = params.get("response_type") ?? "code";
  if (responseType !== "code") {
    return sendJson(res, 400, { error: "unsupported_response_type" }, withCors());
  }

  const clientId = requireString(params, "client_id");
  const redirectUri = requireString(params, "redirect_uri");
  const codeChallenge = requireString(params, "code_challenge");

  if ((params.get("code_challenge_method") ?? "S256") !== "S256") {
    return sendJson(
      res,
      400,
      { error: "invalid_request", message: "Only S256 code_challenge_method is supported" },
      withCors(),
    );
  }

  const client = store.getClient(clientId);
  if (!client) {
    return sendJson(res, 400, { error: "invalid_request", message: "Unknown client_id" }, withCors());
  }
  if (!client.redirectUris.includes(redirectUri)) {
    return sendJson(
      res,
      400,
      { error: "invalid_request", message: "redirect_uri not registered for this client" },
      withCors(),
    );
  }

  const resource = params.get("resource") ?? config.defaultAudience;
  const flowId = store.createAuthFlow({
    clientId,
    redirectUri,
    state: params.get("state") ?? undefined,
    codeChallenge,
    resource,
  });

  const { authorizeUrl } = await startAuthFlow(
    store,
    `${config.baseUrl}/callback?ctx=${flowId}`,
  );
  return redirect(res, authorizeUrl);
}

async function handleCallback(res: ServerResponse, url: URL): Promise<void> {
  const params = url.searchParams;
  const ctxId = requireString(params, "ctx");
  const flow = store.getAuthFlow(ctxId);
  if (!flow) {
    return sendHtml(
      res,
      400,
      ERROR_PAGE("This authorization attempt has expired. Start again from your MCP client."),
    );
  }

  const fail = (code: string, description: string) => {
    const target = new URL(flow.redirectUri);
    if (flow.state) target.searchParams.set("state", flow.state);
    target.searchParams.set("error", code);
    target.searchParams.set("error_description", description);
    target.searchParams.set("iss", config.baseUrl);
    redirect(res, target.toString());
  };

  const supabaseError = params.get("error");
  if (supabaseError) {
    store.deleteAuthFlow(ctxId);
    return fail(supabaseError, params.get("error_description") ?? "Upstream login failed");
  }

  const supabaseCode = requireString(params, "code");
  let user;
  try {
    user = await exchangeSupabaseCode(store, supabaseCode);
  } catch (error) {
    return fail(
      "access_denied",
      error instanceof Error ? error.message : "Login failed",
    );
  }
  store.deleteAuthFlow(ctxId);

  const code = store.createAuthCode({
    clientId: flow.clientId,
    userId: user.id,
    email: user.email,
    redirectUri: flow.redirectUri,
    codeChallenge: flow.codeChallenge,
    resource: flow.resource,
    scope: config.scope,
  });

  const target = new URL(flow.redirectUri);
  target.searchParams.set("code", code);
  if (flow.state) target.searchParams.set("state", flow.state);
  target.searchParams.set("iss", config.baseUrl);
  return redirect(res, target.toString());
}

async function handleToken(res: ServerResponse, req: IncomingMessage): Promise<void> {
  const body = await readFormBody(req);
  const grantType = body.grant_type;

  const jwtSecret = process.env.MCP_JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("MCP_JWT_SECRET is not configured");
  }

  if (grantType === "authorization_code") {
    const clientId = body.client_id;
    const code = body.code;
    const verifier = body.code_verifier;
    const redirectUri = body.redirect_uri;

    if (!clientId || !code || !verifier) {
      return sendJson(res, 400, { error: "invalid_request" }, withCors());
    }

    const client = store.getClient(clientId);
    if (!client) {
      return sendJson(res, 400, { error: "invalid_client" }, withCors());
    }

    const record = store.consumeAuthCode(code);
    if (!record) {
      return sendJson(
        res,
        400,
        { error: "invalid_grant", message: "Authorization code is invalid, expired, or already used" },
        withCors(),
      );
    }
    if (record.clientId !== clientId) {
      return sendJson(
        res,
        400,
        { error: "invalid_grant", message: "Authorization code was not issued to this client" },
        withCors(),
      );
    }
    if (record.redirectUri !== redirectUri) {
      return sendJson(
        res,
        400,
        { error: "invalid_grant", message: "redirect_uri does not match the authorization request" },
        withCors(),
      );
    }
    if (pkceChallenge(verifier) !== record.codeChallenge) {
      return sendJson(
        res,
        400,
        { error: "invalid_grant", message: "PKCE code_verifier does not match" },
        withCors(),
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const accessToken = signAccessToken(
      {
        sub: record.userId,
        email: record.email,
        aud: record.resource,
        iss: config.baseUrl,
      },
      jwtSecret,
      ACCESS_TOKEN_TTL_SECONDS,
      now,
    );
    const refreshToken = store.createRefreshToken({
      userId: record.userId,
      email: record.email,
      clientId,
    });

    return sendJson(
      res,
      200,
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: refreshToken,
        scope: record.scope,
      },
      withCors(),
    );
  }

  if (grantType === "refresh_token") {
    const oldToken = body.refresh_token;
    if (!oldToken) {
      return sendJson(res, 400, { error: "invalid_request" }, withCors());
    }
    const rotated = store.rotateRefreshToken(oldToken);
    if (!rotated) {
      return sendJson(
        res,
        400,
        { error: "invalid_grant", message: "Refresh token is invalid, expired, or already used" },
        withCors(),
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const accessToken = signAccessToken(
      {
        sub: rotated.userId,
        email: rotated.email,
        aud: config.defaultAudience,
        iss: config.baseUrl,
      },
      jwtSecret,
      ACCESS_TOKEN_TTL_SECONDS,
      now,
    );
    const newRefreshToken = store.createRefreshToken({
      userId: rotated.userId,
      email: rotated.email,
      clientId: rotated.clientId,
    });

    return sendJson(
      res,
      200,
      {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        refresh_token: newRefreshToken,
        scope: config.scope,
      },
      withCors(),
    );
  }

  return sendJson(res, 400, { error: "unsupported_grant_type" }, withCors());
}

async function handleRegister(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  if (body === undefined || body === null || typeof body !== "object") {
    return sendJson(
      res,
      400,
      { error: "invalid_client_metadata", message: "A JSON body is required" },
      withCors(),
    );
  }

  const metadata = body as { client_name?: unknown; redirect_uris?: unknown };
  const redirectUris = metadata.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length === 0 ||
    !redirectUris.every((u) => typeof u === "string")
  ) {
    return sendJson(
      res,
      400,
      { error: "invalid_redirect_uri", message: "redirect_uris must be a non-empty array of strings" },
      withCors(),
    );
  }
  const uris = redirectUris as string[];
  for (const uri of uris) {
    if (!isAcceptableRedirectUri(uri)) {
      return sendJson(
        res,
        400,
        { error: "invalid_redirect_uri", message: `redirect_uri is not acceptable: ${uri}` },
        withCors(),
      );
    }
  }

  const client = store.registerClient({
    clientName: typeof metadata.client_name === "string" ? metadata.client_name : undefined,
    redirectUris: uris,
  });

  return sendJson(
    res,
    201,
    {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      code_challenge_method: "S256",
      scope: config.scope,
    },
    withCors(),
  );
}

export function createApp(): Server {
  return new Server((req, res) => {
    void handleRequest(req, res).catch(() => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: "internal_error" });
      } else {
        res.end();
      }
    });
  });
}

export function getStore(): OAuthStore {
  return store;
}

function assertEnv(): void {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("SUPABASE_URL");
  }
  if (!process.env.SUPABASE_ANON_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("SUPABASE_ANON_KEY");
  }
  if (!process.env.MCP_JWT_SECRET) missing.push("MCP_JWT_SECRET");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

// .env loading is dev-only convenience; production passes real env vars.
if (process.env.NODE_ENV === "development") {
  const { config: dotenvConfig } = await import("dotenv");
  dotenvConfig({ quiet: true });
}

const isEntry = process.argv[1]?.replace(/\\/g, "/").endsWith("src/index.ts");
if (isEntry) {
  assertEnv();
  startSweeper(store);
  const app = createApp();
  app.listen(config.port, () => {
    console.log(
      `Broke Besties MCP server listening on ${config.baseUrl} (port ${config.port})`,
    );
  });
}
