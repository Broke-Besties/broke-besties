import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

const TOKEN_PREFIX = "bb_mcp_";

export function hashMcpToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export type CreatedMcpToken = {
  id: string;
  name: string;
  token: string;
  createdAt: Date;
};

export class McpTokenService {
  async listTokens(userId: string) {
    return prisma.mcpToken.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Creates a token and returns the plaintext secret exactly once. Only the
   * SHA-256 hash is stored, so it can never be recovered afterwards.
   */
  async createToken(
    userId: string,
    name: string,
  ): Promise<CreatedMcpToken> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error("Give the credential a name");
    }
    if (trimmed.length > 60) {
      throw new Error("Credential name must be 60 characters or fewer");
    }

    const token = generateToken();
    const record = await prisma.mcpToken.create({
      data: {
        userId,
        name: trimmed,
        tokenHash: hashMcpToken(token),
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return { ...record, token };
  }

  async revokeToken(userId: string, tokenId: string) {
    const result = await prisma.mcpToken.deleteMany({
      where: { id: tokenId, userId },
    });

    if (result.count === 0) {
      throw new Error("Credential not found");
    }

    return { success: true };
  }

  /**
   * Resolves a bearer token to a user id. Returns null for unknown tokens.
   */
  async authenticate(token: string): Promise<string | null> {
    if (!token.startsWith(TOKEN_PREFIX)) return null;

    const record = await prisma.mcpToken.findUnique({
      where: { tokenHash: hashMcpToken(token) },
      select: { id: true, userId: true },
    });

    if (!record) return null;

    await prisma.mcpToken.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    });

    return record.userId;
  }
}

export const mcpTokenService = new McpTokenService();
