import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase";
import { agent } from "@/agents/graph";
import { BaseMessage } from "@langchain/core/messages";

// POST /api/agent - Invoke the LangGraph agent
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messages, groupId, imageUrl, receiptIds, description } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    if (!groupId) {
      return NextResponse.json(
        { error: "Group ID is required" },
        { status: 400 }
      );
    }

    console.log("[Agent Route] Invoking agent");
    console.log("[Agent Route] Group ID:", groupId);
    console.log("[Agent Route] Image URL:", imageUrl || "none");
    console.log("[Agent Route] Receipt IDs:", receiptIds || "none");
    console.log("[Agent Route] Message count:", messages.length);

    // Invoke the agent with the provided state and recursion limit
    const result = await agent.invoke(
      {
        messages: messages as BaseMessage[],
        userId: user.id,
        groupId: parseInt(groupId),
        imageUrl,
        receiptIds,
        description,
      },
      {
        // Prevent infinite loops by limiting recursion
        recursionLimit: 10,
      }
    );

    return NextResponse.json({
      messages: result.messages,
      success: true,
    });
  } catch (error) {
    console.error("Error invoking agent:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
