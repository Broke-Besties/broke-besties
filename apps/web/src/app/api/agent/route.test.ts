import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));
vi.mock("@/mcp/agent", () => ({ runMcpAgent: vi.fn() }));
vi.mock("@/agents/graph", () => ({ agent: { invoke: vi.fn() } }));

import { NextRequest } from "next/server";
import { getUser } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { runMcpAgent } from "@/mcp/agent";
import { agent } from "@/agents/graph";
import { POST } from "./route";

const originalMode = process.env.AGENT_MODE_VERSION;

function request(body: unknown) {
  return new NextRequest("http://localhost/api/agent", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUser).mockResolvedValue({ id: "user-1" } as never);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    premium: true,
  } as never);
  vi.mocked(runMcpAgent).mockResolvedValue({
    messages: [{ type: "ai", content: "MCP answer" }],
    toolCalls: ["list_groups"],
  });
  vi.mocked(agent.invoke).mockResolvedValue({
    messages: [{ type: "ai", content: "Graph answer" }],
  } as never);
});

afterEach(() => {
  if (originalMode === undefined) {
    delete process.env.AGENT_MODE_VERSION;
  } else {
    process.env.AGENT_MODE_VERSION = originalMode;
  }
});

describe("agent route mode gating", () => {
  it("uses the MCP flow without requiring a group in v2", async () => {
    process.env.AGENT_MODE_VERSION = "v2";

    const response = await POST(
      request({ messages: [{ type: "human", content: "What do I owe?" }] }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      mode: "v2",
      success: true,
      messages: [{ type: "ai", content: "MCP answer" }],
      toolCalls: ["list_groups"],
    });
    expect(runMcpAgent).toHaveBeenCalledWith({
      userId: "user-1",
      messages: [{ type: "human", content: "What do I owe?" }],
      groupId: null,
      imageUrl: undefined,
      receiptIds: undefined,
      description: undefined,
    });
    expect(agent.invoke).not.toHaveBeenCalled();
  });

  it("passes an optional group through to the MCP flow", async () => {
    process.env.AGENT_MODE_VERSION = "v2";

    await POST(
      request({
        messages: [{ type: "human", content: "Split dinner" }],
        groupId: "4",
      }),
    );

    expect(runMcpAgent).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: 4 }),
    );
  });

  it("keeps requiring a group for the legacy flow", async () => {
    process.env.AGENT_MODE_VERSION = "v1";

    const response = await POST(
      request({ messages: [{ type: "human", content: "Hello" }] }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Group ID is required",
    });
    expect(runMcpAgent).not.toHaveBeenCalled();
  });

  it("still runs the LangGraph agent for v1 with a group", async () => {
    process.env.AGENT_MODE_VERSION = "v1";

    const response = await POST(
      request({
        messages: [{ type: "human", content: "Split dinner" }],
        groupId: 7,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ mode: "v1", success: true });
    expect(agent.invoke).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", groupId: 7 }),
      { recursionLimit: 10 },
    );
    expect(runMcpAgent).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated and non-premium users before choosing a mode", async () => {
    vi.mocked(getUser).mockResolvedValue(null);
    let response = await POST(request({ messages: [] }));
    expect(response.status).toBe(401);

    vi.mocked(getUser).mockResolvedValue({ id: "user-1" } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      premium: false,
    } as never);
    response = await POST(request({ messages: [] }));
    expect(response.status).toBe(403);
  });
});
