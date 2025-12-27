import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage } from "@langchain/core/messages";
import { AgentState } from "./graph";
import { extractReceiptTextTool } from "./ReceiptTool";
import { createDebt, readDebtsFromGroup } from "./DebtTools";
import { listNamesInGroupTool } from "./UserTool";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
}).bindTools([extractReceiptTextTool, createDebt, readDebtsFromGroup, listNamesInGroupTool]);

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
   - If a user wants to create a debt with a specific person find the userId of the person, use the list_names_in_group tool to list all names in the group, then use the create_debt tool to create the debt. If you cannot find the user or the name is ambiguous, say so and stop.
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
