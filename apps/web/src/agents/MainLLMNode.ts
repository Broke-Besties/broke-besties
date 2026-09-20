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

  let contextMessage = `You are a debt management assistant for a bill-splitting app.
If the user's message is a greeting or unrelated to debts, respond normally.

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

NOTE: When a receipt image is uploaded, the app automatically parses it into
individual items with prices and shows an assignment panel where the user
assigns items to group members manually. You do NOT need to create or propose
debts yourself. Simply acknowledge the receipt and remind the user to assign
the parsed items to their group members in the panel.`;
  } else {
    contextMessage += `

TASK: Help the user with debt and bill-splitting questions.
- You can describe how debts work, but you do NOT create debts or output debt JSON.
- If the user wants to log an expense, tell them to upload a receipt image to
  split it by items, or use the group page to create a debt manually.`;
  }

  contextMessage += `

Do NOT output any JSON with debts. Respond with plain, helpful text.`;

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
