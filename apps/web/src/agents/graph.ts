import {
  START,
  END,
  StateGraph,
  MessagesAnnotation,
  Annotation,
} from "@langchain/langgraph";
import { mainLLMNode } from "./MainLLMNode";
import { extractReceiptTextTool } from "./ReceiptTool";
import { listNamesInGroupTool } from "./UserTool";

const AgentStateAnnotation = Annotation.Root({
  ...MessagesAnnotation.spec,
  userId: Annotation<string>,
  groupId: Annotation<number>,
  imageUrl: Annotation<string | undefined>,
  receiptId: Annotation<string | undefined>,
  description: Annotation<string | undefined>,
  receiptText: Annotation<string | undefined>,
  groupMembers: Annotation<string | undefined>,
});

export type AgentState = typeof AgentStateAnnotation.State;

// Pre-execute all tools before calling the agent
async function prepareContextNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("[Prepare Context] === Starting context preparation ===");

  let receiptText: string | undefined;

  // Execute receipt OCR if imageUrl exists (Gemini call #1)
  if (state.imageUrl) {
    console.log("[Prepare Context] Extracting receipt text...");
    receiptText = await extractReceiptTextTool.invoke({ imageUrl: state.imageUrl });
    console.log("[Prepare Context] Receipt text extracted");
  }

  // Fetch group members (no Gemini call)
  console.log("[Prepare Context] Fetching group members...");
  const groupMembers = await listNamesInGroupTool.invoke({
    userId: state.userId,
    groupId: state.groupId,
  });
  console.log("[Prepare Context] Group members fetched");

  return {
    receiptText,
    groupMembers,
  };
}

export const agent = new StateGraph(AgentStateAnnotation)
  .addNode("prepareContext", prepareContextNode)
  .addNode("agent", mainLLMNode)
  .addEdge(START, "prepareContext")
  .addEdge("prepareContext", "agent")
  .addEdge("agent", END)
  .compile();
