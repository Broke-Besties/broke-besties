import {
  START,
  END,
  StateGraph,
  MessagesAnnotation,
  Annotation,
} from "@langchain/langgraph";
import { mainLLMNode } from "./MainLLMNode";
import { extractReceiptTextTool } from "./ReceiptTool";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage } from "@langchain/core/messages";
import { createDebt, readDebtsFromGroup } from "./DebtTools";
import { listNamesInGroupTool } from "./UserTool";

export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
}

const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  userId: Annotation<string>,
  groupId: Annotation<number>,
  imageUrl: Annotation<string | undefined>,
  imageBase64: Annotation<string | undefined>,
  description: Annotation<string | undefined>,
  pendingAction: Annotation<{
    toolCalls: ToolCall[];
  } | undefined>,
  executeApproved: Annotation<boolean | undefined>,
});

export type AgentState = typeof AgentStateAnnotation.State;

const toolNode = new ToolNode([
  extractReceiptTextTool,
  createDebt,
  readDebtsFromGroup,
  listNamesInGroupTool,
]);

function shouldContinue(state: AgentState): "tools" | "pending" | typeof END {
  const lastMessage = state.messages[state.messages.length - 1] as BaseMessage;

  if (
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    const hasCreateDebt = lastMessage.tool_calls.some(
      (tc: ToolCall) => tc.name === "create_debt"
    );

    // If has create_debt and not approved, go to pending for approval
    if (hasCreateDebt && !state.executeApproved) {
      return "pending";
    }

    // Otherwise, execute tools and continue
    return "tools";
  }

  return END;
}

// Node that stores create_debt calls for approval
async function pendingNode(state: AgentState): Promise<Partial<AgentState>> {
  const lastMessage = state.messages[state.messages.length - 1] as BaseMessage;

  if (
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    const createDebtCalls = lastMessage.tool_calls.filter(
      (tc: ToolCall) => tc.name === "create_debt"
    );

    return {
      pendingAction: {
        toolCalls: createDebtCalls,
      },
    };
  }

  return {};
}

export const agent = new StateGraph(AgentStateAnnotation)
  .addNode("agent", mainLLMNode)
  .addNode("tools", toolNode)
  .addNode("pending", pendingNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .addEdge("pending", END)
  .compile();
