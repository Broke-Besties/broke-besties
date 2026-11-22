"use server";

import { getUser } from "@/lib/supabase";
import { mcpTokenService } from "@/services/mcp-token.service";

export type McpTokenSummary = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export type CreateMcpTokenResult =
  | {
      success: true;
      token: string;
      record: McpTokenSummary;
    }
  | { success: false; error: string };

export async function listMcpTokens(): Promise<McpTokenSummary[]> {
  const user = await getUser();
  if (!user) return [];

  const tokens = await mcpTokenService.listTokens(user.id);
  return tokens.map((token) => ({
    id: token.id,
    name: token.name,
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
  }));
}

export async function createMcpToken(
  name: string,
): Promise<CreateMcpTokenResult> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  try {
    const created = await mcpTokenService.createToken(user.id, name);
    return {
      success: true,
      token: created.token,
      record: {
        id: created.id,
        name: created.name,
        createdAt: created.createdAt.toISOString(),
        lastUsedAt: null,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not create credential",
    };
  }
}

export async function revokeMcpToken(
  tokenId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getUser();
  if (!user) {
    return { success: false, error: "You must be signed in" };
  }

  try {
    await mcpTokenService.revokeToken(user.id, tokenId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Could not revoke credential",
    };
  }
}
