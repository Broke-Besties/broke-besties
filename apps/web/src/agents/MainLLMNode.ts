import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage, BaseMessage, isHumanMessage } from "@langchain/core/messages";
import { AgentState } from "./graph";
import { extractReceiptTextTool } from "./ReceiptTool";
import { createDebt, readDebtsFromGroup } from "./DebtTools";
import { listNamesInGroupTool } from "./UserTool";

async function fetchImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
}).bindTools([extractReceiptTextTool, createDebt, readDebtsFromGroup, listNamesInGroupTool]);

export async function mainLLMNode(
  state: AgentState
): Promise<Partial<AgentState>> {
  console.log("[Agent LLM] === Starting LLM node ===");
  console.log("[Agent LLM] Group ID:", state.groupId);
  console.log("[Agent LLM] User ID:", state.userId);
  console.log("[Agent LLM] Image URL present:", !!state.imageUrl);
  console.log("[Agent LLM] Image Base64 present:", !!state.imageBase64);
  console.log("[Agent LLM] Current message count:", state.messages.length);

  // Build context-aware system message
  let contextMessage = `You are a debt management assistant. Your purpose is to help users create and manage debt records, and process receipt images.

IMPORTANT RULES:
1. If the user greets you (hi, hello, hey, etc.), respond warmly and briefly explain what you can do, then STOP. Do NOT call any tools for greetings.
2. If the user asks something unrelated to debts or receipts, politely say you can only help with debt management and receipt processing, then STOP.
3. Only use tools when the user explicitly wants to:
   - Process a receipt image (use extract_receipt_text tool)
   - Create a debt record (use create_debt tool), if the user does not provide a description, ask for it. 
   - If a user wants to create a debt with a specific person find the userId of the person, use the list_names_in_group tool to list all names in the group, then use the create_debt tool to create the debt. If you cannot find the user or the name is ambiguous, say so and stop.
   - Read debts from a group (use read_debts_from_group tool)
4. After completing a task, summarize what you did and STOP. Do not ask follow-up questions or continue the conversation unless the user asks.

AVAILABLE CONTEXT:
- User ID: ${state.userId}
- Group ID: ${state.groupId}`;

  if (state.description) {
    contextMessage += `\n- Debt description: ${state.description}`;
  }

  // Process messages to inject image into the last human message if imageUrl is provided
  let processedMessages: BaseMessage[] = [...state.messages];

  // Use imageBase64 if available, otherwise fetch from imageUrl
  const imageData = state.imageBase64 || (state.imageUrl ? await fetchImageAsBase64(state.imageUrl) : null);

  if (imageData) {
    // Find the last human message and add the image to it
    const lastHumanIndex = processedMessages.findLastIndex(
      (msg) => (msg as HumanMessage).type === "human"
    );

    if (lastHumanIndex !== -1) {
      const lastHumanMsg = processedMessages[lastHumanIndex];
      const textContent = typeof lastHumanMsg.content === "string"
        ? lastHumanMsg.content
        : "";

      // Replace with multimodal message containing both text and image
      processedMessages[lastHumanIndex] = new HumanMessage({
        content: [
          { type: "image_url", image_url: imageData },
          { type: "text", text: textContent || "Please analyze this receipt image." },
        ],
      });
    }
  }

  const messagesWithContext = [
    new SystemMessage(contextMessage),
    ...processedMessages,
  ];

  console.log("[Agent LLM] Invoking model with", messagesWithContext.length, "messages");
  console.log("[Agent LLM] Has image:", !!imageData);
  if (imageData) {
    console.log("[Agent LLM] Image data length:", imageData.length, "chars");
  }

  const response = await model.invoke(messagesWithContext);

  console.log("[Agent LLM] Response received");
  console.log("[Agent LLM] Response type:", response.constructor.name);
  console.log("[Agent LLM] Has tool calls:", !!(response as any).tool_calls?.length);

  return {
    messages: [response],
  };
}
