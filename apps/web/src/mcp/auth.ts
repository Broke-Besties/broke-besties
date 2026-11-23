import { mcpTokenService } from "@/services/mcp-token.service";

export type McpAuth = {
  userId: string;
  token: string;
};

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  const match = header ? /^Bearer\s+(.+)$/i.exec(header.trim()) : null;
  const token = match?.[1]?.trim();
  return token || null;
}

export async function authenticateMcpRequest(
  request: Request,
): Promise<McpAuth | null> {
  const token = getBearerToken(request);
  if (!token) return null;

  const userId = await mcpTokenService.authenticate(token);
  if (!userId) return null;

  return { userId, token };
}
