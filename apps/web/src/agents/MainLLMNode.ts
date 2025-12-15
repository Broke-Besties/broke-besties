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
  let contextMessage = "You are a receipt processing assistant. ";

  if (state.extractedText) {
    contextMessage += `The receipt text has already been extracted: "${state.extractedText}". Use this text to help the user.`;
  } else if (state.imageUrl) {
    contextMessage += `A receipt image is available at: ${state.imageUrl}. If you need to read the receipt, use the extract_receipt_text tool with this URL.`;
  } else {
    contextMessage += "No receipt data is currently available.";
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
