import { NextRequest, NextResponse } from "next/server";

import { getUser } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { getAgentMode } from "@/mcp/mode";
import type { BaseMessage } from "@langchain/core/messages";

type AgentRequestBody = {
  messages?: unknown;
  groupId?: number | string | null;
  imageUrl?: string | null;
  receiptIds?: string[];
  description?: string;
};

function parseGroupId(value: AgentRequestBody["groupId"]) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

// POST /api/agent - Invoke the assistant (LangGraph v1 or MCP-backed v2).
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Gate AI assistant behind premium
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { premium: true },
    });

    if (!dbUser?.premium) {
      return NextResponse.json(
        {
          error:
            "AI assistant is a premium feature. Upgrade to premium to use it.",
        },
        { status: 403 },
      );
    }

    const { messages, groupId: rawGroupId, imageUrl, receiptIds, description } =
      (await request.json()) as AgentRequestBody;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 },
      );
    }

    const groupId = parseGroupId(rawGroupId);
    const mode = getAgentMode();

    // v1 needs a group because the graph eagerly loads group members. v2 uses
    // tools to discover groups, so a preselected group is optional.
    if (mode === "v1" && groupId === null) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 },
      );
    }

    if (mode === "v2") {
      // Imported dynamically so the v1 path never loads the MCP stack.
      const { runMcpAgent } = await import("@/mcp/agent");
      const result = await runMcpAgent({
        userId: user.id,
        messages,
        groupId,
        imageUrl,
        receiptIds,
        description,
      });

      return NextResponse.json({
        messages: result.messages,
        toolCalls: result.toolCalls,
        mode,
        success: true,
      });
    }

    // Imported dynamically so the v2 path never loads LangGraph.
    const { agent } = await import("@/agents/graph");

    console.log("[Agent Route] Invoking LangGraph agent");
    console.log("[Agent Route] Group ID:", groupId);
    console.log("[Agent Route] Image URL:", imageUrl || "none");
    console.log("[Agent Route] Receipt IDs:", receiptIds || "none");
    console.log("[Agent Route] Message count:", messages.length);

    const result = await agent.invoke(
      {
        messages: messages as BaseMessage[],
        userId: user.id,
        groupId: groupId as number,
        imageUrl: imageUrl ?? undefined,
        receiptIds,
        description,
      },
      {
        recursionLimit: 10,
      },
    );

    return NextResponse.json({
      messages: result.messages,
      mode,
      success: true,
    });
  } catch (error) {
    console.error("Error invoking agent:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
