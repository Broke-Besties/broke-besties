import { START, END, StateGraph, MessagesAnnotation, Annotation } from "@langchain/langgraph";
import { mainLLMNode } from "./MainLLMNode";
import { extractReceiptTextTool } from "./ReceiptNode";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { BaseMessage } from "@langchain/core/messages";

const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  groupId: Annotation<number>,
  imageUrl: Annotation<string | undefined>,
  extractedText: Annotation<string | undefined>,
});

export type AgentState = typeof AgentStateAnnotation.State;

const toolNode = new ToolNode([extractReceiptTextTool]);

function shouldContinue(state: AgentState): "tools" | typeof END {
  const lastMessage = state.messages[state.messages.length - 1] as BaseMessage;

  if (
    "tool_calls" in lastMessage &&
    Array.isArray(lastMessage.tool_calls) &&
    lastMessage.tool_calls.length > 0
  ) {
    return "tools";
  }

  return END;
}

export const agent = new StateGraph(AgentStateAnnotation)
  .addNode("agent", mainLLMNode)
  .addNode("tools", toolNode)
  .addEdge(START, "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent")
  .compile();

