import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

import { createLinkedMcpClient, type LinkedMcpClient } from "./client";
import { toolDefinitions } from "./tools";
import { errorMessage } from "./types";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_MAX_STEPS = 8;

export type IncomingAgentMessage = {
  type?: string;
  role?: string;
  content?: unknown;
};

export type RunMcpAgentInput = {
  userId: string;
  messages: IncomingAgentMessage[];
  groupId?: number | null;
  imageUrl?: string | null;
  receiptIds?: string[];
  description?: string;
};

export type RunMcpAgentResult = {
  messages: Array<{ type: "ai"; content: string }>;
  toolCalls: string[];
};

type AgentModel = {
  bindTools(tools: StructuredToolInterface[]): {
    invoke(messages: BaseMessage[]): Promise<AIMessage>;
  };
};

export type RunMcpAgentDeps = {
  createClient?: (userId: string) => Promise<LinkedMcpClient>;
  model?: AgentModel;
  maxSteps?: number;
};

function contentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === "string") return block;
        if (
          block &&
          typeof block === "object" &&
          "text" in block &&
          typeof (block as { text?: unknown }).text === "string"
        ) {
          return (block as { text: string }).text;
        }
        return "";
      })
      .join("");
  }
  if (content == null) return "";
  return JSON.stringify(content);
}

function toBaseMessages(messages: IncomingAgentMessage[]): BaseMessage[] {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => {
      const content = contentToText(message.content);
      const isUser =
        message.type === "human" || message.role === "user";
      return isUser ? new HumanMessage(content) : new AIMessage(content);
    });
}

function extractToolText(result: unknown): string {
  if (
    result &&
    typeof result === "object" &&
    "content" in result &&
    Array.isArray((result as { content?: unknown }).content)
  ) {
    return (
      (result as { content: Array<{ type?: string; text?: string }> }).content
        .map((item) =>
          item.type === "text" && typeof item.text === "string"
            ? item.text
            : "",
        )
        .filter(Boolean)
        .join("\n") || "Tool returned no text."
    );
  }
  return JSON.stringify(result);
}

function buildSystemPrompt(input: RunMcpAgentInput): string {
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    "You are the Broke Besties money assistant for a bill-splitting app.",
    `Today is ${today}. Amounts are in Canadian dollars unless the user says otherwise.`,
    "",
    "You can inspect and change the user's real data through the provided tools. Use them instead of guessing.",
    "Guidelines:",
    "- Never invent group ids, debt ids, user ids, amounts, or balances. Look them up with tools first.",
    "- The user does not need to choose a group before chatting. Use list_groups or list_debts to find the right context.",
    "- Before creating a debt, make sure you know the amount, who borrowed from whom, and optionally the group. Ask one short clarifying question when something is missing.",
    "- The signed-in user is always the lender for create_debt. Use list_friends to find a borrower's id, or ask for their email.",
    "- Use get_balance_summary or list_debts for money questions so answers reflect real records.",
    "- Calendar events are private by default. Before sharing an event, look up group ids with list_groups and confirm which groups should see it.",
    "- When sharing a calendar event, choose visibility 'details' to show the event or 'busy' to hide its title and just block the time.",
    "- If the user wants people to see an event without being invited, share details with allowRsvp false (view only).",
    "- Calendar times are shown in the user's saved timezone; use get_calendar_settings or set_calendar_timezone when the timezone matters.",
    "- Use list_calendar_events for schedule questions and rsvp_calendar_event when the user says they will or will not attend.",
    "- When you take an action, briefly confirm what changed and include the relevant ids.",
    "- Be concise and conversational. Do not output JSON unless the user asks for it.",
  ];

  if (input.groupId) {
    lines.push(
      "",
      `The UI currently has group id ${input.groupId} selected, but you decide whether it is relevant.`,
    );
  }

  if (input.description) {
    lines.push("", `Request context: ${input.description}`);
  }

  if (input.imageUrl || input.receiptIds?.length) {
    lines.push(
      "",
      "A receipt is attached in the UI. Receipt items are assigned to group members in a dedicated panel, so do not create per-item debts yourself; help with everything else.",
    );
  }

  return lines.join("\n");
}

function buildTools(client: Client): StructuredToolInterface[] {
  return toolDefinitions.map((definition) =>
    tool(
      async (args) => {
        const result = await client.callTool({
          name: definition.name,
          arguments: args as Record<string, unknown>,
        });
        return extractToolText(result);
      },
      {
        name: definition.name,
        description: definition.description,
        schema: z.object(definition.schema),
      },
    ),
  );
}

/**
 * Runs the v2 assistant: an in-process MCP server scoped to the user, plus a
 * tool-calling loop that can read and write the user's real data.
 */
export async function runMcpAgent(
  input: RunMcpAgentInput,
  deps: RunMcpAgentDeps = {},
): Promise<RunMcpAgentResult> {
  const createClient = deps.createClient ?? createLinkedMcpClient;
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS;
  const model =
    deps.model ??
    (new ChatGoogleGenerativeAI({
      model: process.env.AGENT_MODEL ?? DEFAULT_MODEL,
      apiKey: process.env.GOOGLE_API_KEY,
      temperature: 0,
    }) as unknown as AgentModel);

  const { client, close } = await createClient(input.userId);

  try {
    const tools = buildTools(client);
    const modelWithTools = model.bindTools(tools);
    const conversation: BaseMessage[] = [
      new SystemMessage(buildSystemPrompt(input)),
      ...toBaseMessages(input.messages),
    ];
    const toolCalls: string[] = [];

    for (let step = 0; step < maxSteps; step++) {
      const response = await modelWithTools.invoke(conversation);
      conversation.push(response);

      const calls = response.tool_calls ?? [];
      if (calls.length === 0) {
        return {
          messages: [
            { type: "ai", content: contentToText(response.content) },
          ],
          toolCalls,
        };
      }

      for (const call of calls) {
        toolCalls.push(call.name);
        let text: string;
        let status: "success" | "error" = "success";

        try {
          const result = await client.callTool({
            name: call.name,
            arguments: (call.args ?? {}) as Record<string, unknown>,
          });
          text = extractToolText(result);
          if (
            result &&
            typeof result === "object" &&
            "isError" in result &&
            result.isError
          ) {
            status = "error";
          }
        } catch (error) {
          text = errorMessage(error);
          status = "error";
        }

        conversation.push(
          new ToolMessage({
            content: text,
            tool_call_id: call.id ?? call.name,
            name: call.name,
            status,
          }),
        );
      }
    }

    return {
      messages: [
        {
          type: "ai",
          content:
            "I stopped after several tool calls without finishing. Please try a narrower request.",
        },
      ],
      toolCalls,
    };
  } finally {
    await close();
  }
}
