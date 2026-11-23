import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
  const { createMockPrisma } = await import("../test/mocks");
  return { prisma: createMockPrisma() };
});

import { prisma } from "@/lib/prisma";
import {
  hashMcpToken,
  mcpTokenService,
} from "./mcp-token.service";

const db = prisma as unknown as {
  mcpToken: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MCP token service", () => {
  it("stores only a hash and returns the secret once", async () => {
    db.mcpToken.create.mockResolvedValue({
      id: "token-1",
      name: "Claude",
      createdAt: new Date("2026-09-28"),
    });

    const created = await mcpTokenService.createToken("user-1", " Claude ");

    expect(created.token.startsWith("bb_mcp_")).toBe(true);
    expect(created.name).toBe("Claude");

    const data = db.mcpToken.create.mock.calls[0][0].data;
    expect(data).toEqual({
      userId: "user-1",
      name: "Claude",
      tokenHash: hashMcpToken(created.token),
    });
    expect(JSON.stringify(data)).not.toContain(created.token);
  });

  it("resolves a valid token to its user and touches lastUsedAt", async () => {
    db.mcpToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
    });
    db.mcpToken.update.mockResolvedValue({});

    const token = "bb_mcp_secret";
    await expect(mcpTokenService.authenticate(token)).resolves.toBe("user-1");

    expect(db.mcpToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashMcpToken(token) },
      select: { id: true, userId: true },
    });
    expect(db.mcpToken.update).toHaveBeenCalledWith({
      where: { id: "token-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("rejects unknown or malformed tokens without a database lookup", async () => {
    db.mcpToken.findUnique.mockResolvedValue(null);

    await expect(mcpTokenService.authenticate("bb_mcp_unknown")).resolves.toBeNull();
    await expect(mcpTokenService.authenticate("not-ours")).resolves.toBeNull();

    expect(db.mcpToken.findUnique).toHaveBeenCalledTimes(1);
  });

  it("revokes only credentials owned by the user", async () => {
    db.mcpToken.deleteMany.mockResolvedValue({ count: 1 });

    await mcpTokenService.revokeToken("user-1", "token-1");

    expect(db.mcpToken.deleteMany).toHaveBeenCalledWith({
      where: { id: "token-1", userId: "user-1" },
    });
  });
});
