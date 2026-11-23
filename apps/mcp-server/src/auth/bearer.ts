import { IncomingMessage } from "node:http";
import { config } from "../config";
import { HttpError } from "../lib/http";
import { verifyAccessToken } from "../lib/tokens";
import type { ToolContext } from "../mcp/tools";

function secret(): string {
  const value = process.env.MCP_JWT_SECRET;
  if (!value) throw new Error("MCP_JWT_SECRET is not configured");
  return value;
}

/**
 * Validates `Authorization: Bearer <access token>` on /mcp requests.
 * Tokens are first-party JWTs whose `sub` is the Supabase user id.
 */
export function authenticate(req: IncomingMessage): ToolContext {
  const header = req.headers.authorization ?? "";
  const [scheme, token] = header.split(" ");

  if (
    scheme !== "Bearer" ||
    !token ||
    token !== token.trim() ||
    token.split(".").length !== 3
  ) {
    throw unauthorized('header is missing or malformed. Expected: "Authorization: Bearer <token>"');
  }

  const claims = verifyAccessToken(token, secret(), {
    issuer: config.baseUrl,
    audience: config.defaultAudience,
  });
  if (!claims) {
    throw unauthorized("token is invalid or expired");
  }

  return { userId: claims.sub, email: claims.email };
}

function unauthorized(message: string): HttpError {
  return new HttpError(401, message, "unauthorized");
}

export const bearerChallengeHeaders = (
  error: "invalid_request" | "invalid_token" = "invalid_token",
) => ({
  "www-authenticate": `Bearer error="${error}", resource_metadata="${config.baseUrl}/.well-known/oauth-protected-resource"`,
});
