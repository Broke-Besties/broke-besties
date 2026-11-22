import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  debtService: {
    getUserDebts: vi.fn(),
    getGroupDebts: vi.fn(),
    getDebtById: vi.fn(),
    createDebt: vi.fn(),
    updateDebt: vi.fn(),
    deleteDebt: vi.fn(),
  },
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
  groupService: {
    getUserGroups: vi.fn(),
    getGroupById: vi.fn(),
    createGroup: vi.fn(),
  },
  userService: {
    getUserById: vi.fn(),
    findOrCreatePlaceholderByEmail: vi.fn(),
  },
}));

vi.mock("@/services/debt.service", () => ({
  debtService: mocks.debtService,
}));
vi.mock("@/services/friend.service", () => ({
  friendService: mocks.friendService,
}));
vi.mock("@/services/group.service", () => ({
  groupService: mocks.groupService,
}));
vi.mock("@/services/user.service", () => ({
  userService: mocks.userService,
}));

import { createLinkedMcpClient } from "./client";

const me = {
  id: "user-1",
  name: "Larry",
  email: "larry@x.com",
  premium: true,
  signedUp: true,
};
const alex = {
  id: "user-2",
  name: "Alex",
  email: "alex@x.com",
  signedUp: true,
};
const debt = {
  id: 9,
  amount: 12.5,
  description: "Pizza",
  status: "pending",
  lenderId: me.id,
  borrowerId: alex.id,
  group: { id: 4, name: "Besties" },
  lender: me,
  borrower: alex,
  createdAt: new Date("2026-09-01"),
};

function text(result: unknown) {
  if (
    !result ||
    typeof result !== "object" ||
    !("content" in result) ||
    !Array.isArray((result as { content?: unknown }).content)
  ) {
    return "";
  }
  return (result as { content: unknown[] }).content
    .map((item) => {
      if (item && typeof item === "object" && "text" in item) {
        return String((item as { text?: unknown }).text ?? "");
      }
      return "";
    })
    .join("\n");
}

async function withClient(run: (client: Awaited<ReturnType<typeof createLinkedMcpClient>>) => Promise<void>) {
  const linked = await createLinkedMcpClient(me.id);
  try {
    await run(linked);
  } finally {
    await linked.close();
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.userService.getUserById.mockResolvedValue(me);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Broke Besties MCP tools", () => {
  it("exposes read and write tools with no user id input", async () => {
    await withClient(async ({ client }) => {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name);

      expect(names).toEqual(
        expect.arrayContaining([
          "list_groups",
          "list_debts",
          "get_balance_summary",
          "create_debt",
          "update_debt",
          "create_group",
          "send_friend_request",
        ]),
      );

      for (const tool of tools) {
        const properties = (tool.inputSchema.properties ?? {}) as Record<
          string,
          unknown
        >;
        expect(Object.keys(properties)).not.toContain("userId");
      }
    });
  });

  it("scopes reads to the authenticated user", async () => {
    mocks.userService.getUserById.mockResolvedValue(me);
    mocks.groupService.getUserGroups.mockResolvedValue([]);
    mocks.debtService.getUserDebts.mockResolvedValue([debt]);

    await withClient(async ({ client }) => {
      const meResult = await client.callTool({ name: "get_me", arguments: {} });
      expect(text(meResult)).toContain('"email": "larry@x.com"');

      const debtsResult = await client.callTool({
        name: "list_debts",
        arguments: {},
      });
      expect(mocks.debtService.getUserDebts).toHaveBeenCalledWith(me.id, {
        type: null,
        status: null,
      });
      expect(text(debtsResult)).toContain('"direction": "you_are_owed"');
    });
  });

  it("creates debts as the authenticated user and resolves borrowers by email", async () => {
    mocks.userService.findOrCreatePlaceholderByEmail.mockResolvedValue({
      ...alex,
      id: "placeholder-1",
    });
    mocks.debtService.createDebt.mockResolvedValue({
      ...debt,
      borrowerId: "placeholder-1",
      borrower: { ...alex, id: "placeholder-1" },
    });

    await withClient(async ({ client }) => {
      const result = await client.callTool({
        name: "create_debt",
        arguments: {
          amount: 20,
          description: "Tacos",
          borrowerEmail: "alex@x.com",
          groupId: 4,
        },
      });

      expect(mocks.groupService.getGroupById).toHaveBeenCalledWith(4, me.id);
      expect(mocks.userService.findOrCreatePlaceholderByEmail).toHaveBeenCalledWith(
        "alex@x.com",
      );
      expect(mocks.debtService.createDebt).toHaveBeenCalledWith({
        amount: 20,
        description: "Tacos",
        lenderId: me.id,
        borrowerId: "placeholder-1",
        groupId: 4,
        receiptIds: undefined,
      });
      expect(result.isError).toBeFalsy();
    });
  });

  it("requires exactly one borrower identifier", async () => {
    await withClient(async ({ client }) => {
      const result = await client.callTool({
        name: "create_debt",
        arguments: { amount: 5 },
      });

      expect(result.isError).toBe(true);
      expect(text(result)).toContain(
        "Provide exactly one of borrowerId or borrowerEmail",
      );
      expect(mocks.debtService.createDebt).not.toHaveBeenCalled();
    });
  });

  it("summarizes outstanding balances", async () => {
    mocks.debtService.getUserDebts.mockResolvedValue([
      debt,
      {
        ...debt,
        id: 10,
        amount: 7.25,
        lenderId: alex.id,
        borrowerId: me.id,
        borrower: me,
      },
    ]);

    await withClient(async ({ client }) => {
      const result = await client.callTool({
        name: "get_balance_summary",
        arguments: {},
      });

      const parsed = JSON.parse(text(result));
      expect(parsed).toMatchObject({
        totalOwedToYou: 12.5,
        totalYouOwe: 7.25,
        net: 5.25,
        pendingDebts: 2,
      });
    });
  });
});
