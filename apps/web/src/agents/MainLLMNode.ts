import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage } from "@langchain/core/messages";
import { AgentState } from "./graph";
import { extractReceiptTextTool } from "./ReceiptTool";
import { createDebt, readDebtsFromGroup } from "./DebtTools";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
}).bindTools([extractReceiptTextTool, createDebt, readDebtsFromGroup]);

export async function mainLLMNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  // Build context-aware system message
  let contextMessage = `You are a debt management assistant. Your purpose is to help users create and manage debt records, and process receipt images.

IMPORTANT RULES:
1. If the user greets you (hi, hello, hey, etc.), respond warmly and briefly explain what you can do, then STOP. Do NOT call any tools for greetings.
2. If the user asks something unrelated to debts or receipts, politely say you can only help with debt management and receipt processing, then STOP.
3. Only use tools when the user explicitly wants to:
   - Process a receipt image (use extract_receipt_text tool)
   - Create a debt record (use create_debt tool)
   - Read debts from a group (use read_debts_from_group tool)
4. After completing a task, summarize what you did and STOP. Do not ask follow-up questions or continue the conversation unless the user asks.

AVAILABLE CONTEXT:
- User ID: ${state.userId}
- Group ID: ${state.groupId}`;

  if (state.imageUrl) {
    contextMessage += `\n- Receipt image available at: ${state.imageUrl}`;
  }

  if (state.description) {
    contextMessage += `\n- Debt description: ${state.description}`;
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
