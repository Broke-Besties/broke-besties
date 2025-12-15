import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage } from "@langchain/core/messages";
import { AgentState } from "./graph";
import { extractReceiptTextTool } from "./ReceiptNode";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash-exp",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
}).bindTools([extractReceiptTextTool]);

export async function mainLLMNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  // Build context-aware system message
  let contextMessage = "You are a debt creation assistant. You are either given a receipt image or description of a debt. You need to create a debt record based on the information provided. ";

  if (state.imageUrl) {
    contextMessage += `A receipt image is available at: ${state.imageUrl}. If you need to read the receipt, use the extract_receipt_text tool with this URL.`;
  } else if (state.description) {
    contextMessage += `A description of a debt is available: ${state.description}.`;
  }

  const messagesWithContext = [
    new SystemMessage(contextMessage),
    ...state.messages,
  ];

  const response = await model.invoke(messagesWithContext);

  return {
    messages: [response],
  };
}
