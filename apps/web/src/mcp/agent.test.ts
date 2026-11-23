import { describe, expect, it, vi } from "vitest";
import { AIMessage, ToolMessage } from "@langchain/core/messages";

vi.mock("./client", () => ({ createLinkedMcpClient: vi.fn() }));
vi.mock("./tools", () => ({
  toolDefinitions: [
    { name: "list_groups", title: "List groups", description: "", schema: {}, handler: vi.fn() },
    { name: "list_debts", title: "List debts", description: "", schema: {}, handler: vi.fn() },
    {
      name: "get_group",
      title: "Get group",
      description: "",
      schema: {},
      handler: vi.fn(),
    },
  ],
}));

import { runMcpAgent } from "./agent";

function toolCall(name: string, args: Record<string, unknown> = {}) {
  return {
    name,
    args,
    id: `call-${name}`,
    type: "tool_call" as const,
  };
}

describe("MCP agent loop", () => {
  it("executes MCP tool calls and returns the final answer", async () => {
    const callTool = vi.fn(async ({ name }: { name: string }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify([{ id: 1, name: name === "list_groups" ? "Besties" : "x" }]),
        },
      ],
    }));
    const conversations: unknown[][] = [];
    const invoke = vi.fn(async (messages: unknown[]) => {
      conversations.push([...messages]);
      return conversations.length === 1
        ? new AIMessage({
            content: "",
            tool_calls: [toolCall("list_groups")],
          })
        : new AIMessage("You have one group: Besties.");
    });
    const bindTools = vi.fn(() => ({ invoke }));
    const close = vi.fn(async () => {});

    const result = await runMcpAgent(
      {
        userId: "user-1",
        messages: [{ type: "human", content: "What groups do I have?" }],
      },
      {
        createClient: async () =>
          ({
            client: { callTool },
            close,
          }) as never,
        model: { bindTools } as never,
      },
    );

    expect(bindTools).toHaveBeenCalledOnce();
    expect(callTool).toHaveBeenCalledWith({
      name: "list_groups",
      arguments: {},
    });
    expect(result.toolCalls).toEqual(["list_groups"]);
    expect(result.messages).toEqual([
      { type: "ai", content: "You have one group: Besties." },
    ]);
    expect(close).toHaveBeenCalledOnce();

    const toolMessage = conversations[1].at(-1) as ToolMessage;
    expect(toolMessage).toBeInstanceOf(ToolMessage);
    expect(toolMessage.content).toContain("Besties");
  });

  it("stops after the step limit when the model keeps calling tools", async () => {
    const callTool = vi.fn(async () => ({
      content: [{ type: "text", text: "ok" }],
    }));
    const invoke = vi.fn(async () => new AIMessage({
      content: "",
      tool_calls: [toolCall("list_debts")],
    }));

    const result = await runMcpAgent(
      {
        userId: "user-1",
        messages: [{ type: "human", content: "loop" }],
      },
      {
        createClient: async () =>
          ({ client: { callTool }, close: async () => {} }) as never,
        model: { bindTools: () => ({ invoke }) } as never,
        maxSteps: 3,
      },
    );

    expect(invoke).toHaveBeenCalledTimes(3);
    expect(callTool).toHaveBeenCalledTimes(3);
    expect(result.toolCalls).toEqual(["list_debts", "list_debts", "list_debts"]);
    expect(result.messages[0].content).toContain("stopped after several tool calls");
  });

  it("reports tool failures back to the model instead of throwing", async () => {
    const callTool = vi.fn(async () => {
      throw new Error("You must be a member of the group");
    });
    const conversations: unknown[][] = [];
    const invoke = vi.fn(async (messages: unknown[]) => {
      conversations.push([...messages]);
      return conversations.length === 1
        ? new AIMessage({
            content: "",
            tool_calls: [toolCall("get_group", { groupId: 99 })],
          })
        : new AIMessage("That group is not yours.");
    });

    const result = await runMcpAgent(
      {
        userId: "user-1",
        messages: [{ type: "human", content: "Show group 99" }],
      },
      {
        createClient: async () =>
          ({ client: { callTool }, close: async () => {} }) as never,
        model: { bindTools: () => ({ invoke }) } as never,
      },
    );

    const conversation = conversations[1];
    expect((conversation.at(-1) as ToolMessage).content).toContain(
      "must be a member",
    );
    expect(result.messages[0].content).toBe("That group is not yours.");
  });
});
