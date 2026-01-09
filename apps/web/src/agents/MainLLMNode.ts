import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, BaseMessage } from "@langchain/core/messages";
import { AgentState } from "./graph";
import { extractReceiptTextTool } from "./ReceiptTool";
import { readDebtsFromGroup } from "./DebtTools";
import { listNamesInGroupTool } from "./UserTool";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
}).bindTools([extractReceiptTextTool, readDebtsFromGroup, listNamesInGroupTool]);

export async function mainLLMNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("[Agent LLM] === Starting LLM node ===");
  console.log("[Agent LLM] Group ID:", state.groupId);
  console.log("[Agent LLM] User ID:", state.userId);
  console.log("[Agent LLM] Image URL:", state.imageUrl || "none");
  console.log("[Agent LLM] Current message count:", state.messages.length);

  let contextMessage = `You are a function-calling debt management assistant. 
  If the user's message is a greeting or unrelated to debts, respond normally and do not use tools.
  Otherwise, you MUST use tools to complete tasks.`;

  if (state.imageUrl) {
    contextMessage += `

TASK: Process receipt image at ${state.imageUrl}

REQUIRED ACTIONS (you must call these tools):
1. First, call extract_receipt_text tool with imageUrl parameter
2. After getting receipt data, call list_names_in_group if user mentioned names
3. Finally, output the debts JSON

User message may contain names and items. Example:
- User: "albert owes me lorem"
- You MUST call: extract_receipt_text(imageUrl="${state.imageUrl}")
- Tool returns: "Lorem 1.1..."
- You MUST call: list_names_in_group(userId="${state.userId}", groupId=${state.groupId})
- Tool returns: user IDs
- You output: {"debtsReady":true,"debts":[...]}

START BY CALLING extract_receipt_text NOW.`;
  } else {
    contextMessage += `

TASK: Create manual debt entry

Ask user for who owes money, amount, and description if not provided.
Use list_names_in_group tool to get user IDs.
Output the debt JSON when ready.`;
  }

  contextMessage += `

Output format: {"debtsReady":true,"debts":[{"borrowerName":"Name","borrowerId":"id","amount":10.5,"description":"item"}]}

Context: userId=${state.userId}, groupId=${state.groupId}`;

  if (state.description) {
    contextMessage += `, description=${state.description}`;
  }

  const processedMessages: BaseMessage[] = [...state.messages];

  const messagesWithContext = [
    new SystemMessage(contextMessage),
    ...processedMessages,
  ];

  console.log("[Agent LLM] Invoking model with", messagesWithContext.length, "messages");
  console.log("[Agent LLM] System message length:", contextMessage.length, "chars");

  const response = await model.invoke(messagesWithContext);

  console.log("[Agent LLM] Response received");
  console.log("[Agent LLM] Response type:", response.constructor.name);
  console.log("[Agent LLM] Has tool calls:", !!(response as any).tool_calls?.length);

  return {
    messages: [response],
  };
}
