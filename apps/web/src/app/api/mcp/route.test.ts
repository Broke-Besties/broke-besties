import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/mcp-token.service", () => ({
  mcpTokenService: { authenticate: vi.fn() },
}));
vi.mock("@/services/user.service", () => ({
  userService: { getUserById: vi.fn(), findOrCreatePlaceholderByEmail: vi.fn() },
}));
vi.mock("@/services/debt.service", () => ({
  debtService: {
    getUserDebts: vi.fn(),
    getGroupDebts: vi.fn(),
    getDebtById: vi.fn(),
    createDebt: vi.fn(),
    updateDebt: vi.fn(),
    deleteDebt: vi.fn(),
  },
}));
vi.mock("@/services/group.service", () => ({
  groupService: {
    getUserGroups: vi.fn(),
    getGroupById: vi.fn(),
    createGroup: vi.fn(),
  },
}));
vi.mock("@/services/friend.service", () => ({
  friendService: {
    getFriends: vi.fn(),
    getPendingRequests: vi.fn(),
    getSentRequests: vi.fn(),
    sendFriendRequestByEmail: vi.fn(),
    acceptFriendRequest: vi.fn(),
    rejectFriendRequest: vi.fn(),
    cancelFriendRequest: vi.fn(),
    removeFriend: vi.fn(),
  },
}));

import { NextRequest } from "next/server";
import { mcpTokenService } from "@/services/mcp-token.service";
import { userService } from "@/services/user.service";
import { POST } from "./route";

const initBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "vitest", version: "1.0.0" },
  },
};

function mcpRequest(body: unknown, token = "bb_mcp_test") {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  return new NextRequest("http://localhost/api/mcp", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

async function initialize(token: string) {
  return POST(mcpRequest(initBody, token));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(mcpTokenService.authenticate).mockResolvedValue("user-1");
  vi.mocked(userService.getUserById).mockResolvedValue({
    id: "user-1",
    name: "Larry",
    email: "larry@x.com",
    premium: true,
    signedUp: true,
  } as never);
});

describe("MCP HTTP endpoint", () => {
  it("rejects requests without a valid bearer credential", async () => {
    let response = await POST(mcpRequest(initBody, ""));
    expect(response.status).toBe(401);

    vi.mocked(mcpTokenService.authenticate).mockResolvedValue(null);
    response = await POST(mcpRequest(initBody));
    expect(response.status).toBe(401);
  });

  it("initializes and lists the scoped tools without server-side sessions", async () => {
    const token = "bb_mcp_lists_tools";
    const response = await initialize(token);

    expect(response.status).toBe(200);
    const init = await response.json();
    expect(init.result.serverInfo.name).toBe("broke-besties");

    await POST(
      mcpRequest(
        { jsonrpc: "2.0", method: "notifications/initialized" },
        token,
      ),
    );

    const listResponse = await POST(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }, token),
    );
    const list = await listResponse.json();

    expect(listResponse.status).toBe(200);
    expect(list.result.tools.map((tool: { name: string }) => tool.name)).toEqual(
      expect.arrayContaining(["list_debts", "create_debt", "list_groups"]),
    );
  });

  it("runs tools as the user who owns the credential", async () => {
    const token = "bb_mcp_runs_tools";

    const response = await POST(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "get_me", arguments: {} },
        },
        token,
      ),
    );
    const body = await response.json();

    expect(userService.getUserById).toHaveBeenCalledWith("user-1");
    expect(body.result.content[0].text).toContain("larry@x.com");
  });

  it("scopes every request to the credential's user", async () => {
    vi.mocked(mcpTokenService.authenticate).mockResolvedValue("user-2");
    vi.mocked(userService.getUserById).mockResolvedValue({
      id: "user-2",
      name: "Alex",
      email: "alex@x.com",
      premium: true,
      signedUp: true,
    } as never);

    const response = await POST(
      mcpRequest(
        {
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: { name: "get_me", arguments: {} },
        },
        "bb_mcp_other",
      ),
    );
    const body = await response.json();

    expect(userService.getUserById).toHaveBeenCalledWith("user-2");
    expect(body.result.content[0].text).toContain("alex@x.com");
  });
});
