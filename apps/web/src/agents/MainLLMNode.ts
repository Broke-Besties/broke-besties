import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, BaseMessage } from "@langchain/core/messages";
import { AgentState } from "./graph";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
});

export async function mainLLMNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("[Agent LLM] === Starting LLM node ===");
  console.log("[Agent LLM] Group ID:", state.groupId);
  console.log("[Agent LLM] User ID:", state.userId);
  console.log("[Agent LLM] Has receipt text:", !!state.receiptText);
  console.log("[Agent LLM] Has group members:", !!state.groupMembers);
  console.log("[Agent LLM] Current message count:", state.messages.length);

  let contextMessage = `You are a debt management assistant that processes receipts and debt entries.
If the user's message is a greeting or unrelated to debts, respond normally.
Otherwise, analyze the provided data and output the debts JSON.

Context:
- User ID: ${state.userId}
- Group ID: ${state.groupId}`;

  if (state.description) {
    contextMessage += `
- Description: ${state.description}`;
  }

  if (state.groupMembers) {
    contextMessage += `

GROUP MEMBERS (id: name):
${state.groupMembers}`;
  }

  if (state.receiptText) {
    contextMessage += `

RECEIPT TEXT (extracted via OCR):
${state.receiptText}

TASK: Parse this receipt and match items to people mentioned in the user's message.
- User may mention names and items (e.g., "albert owes me for the pizza")
- Match names to the group members list above
- Extract amounts from the receipt text
- Create debt entries for each person/item pair`;
  } else {
    contextMessage += `

TASK: Create manual debt entry based on user's message.
- User should provide who owes money, amount, and description
- Match names to the group members list above
- If information is missing, ask the user for clarification`;
  }

  contextMessage += `

OUTPUT FORMAT (respond ONLY with this JSON structure):
{"debtsReady":true,"debts":[{"borrowerName":"Name","borrowerId":"id","amount":10.5,"description":"item"}]}

If you need more information from the user, respond with plain text (not JSON) asking for clarification.`;

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

  return {
    messages: [response],
  };
}
