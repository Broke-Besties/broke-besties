import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { fetchImageAsBase64 } from "./ReceiptTool";

export type ParsedReceiptItem = {
  name: string;
  price: number;
};

export type ParsedReceipt = {
  rawText: string;
  items: ParsedReceiptItem[];
};

const itemModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
  temperature: 0,
});

const EXTRACT_ITEMS_PROMPT =
  "You are a receipt parser. Read this receipt image and extract every line item " +
  "with its price. Ignore subtotal, tax, tip, discount and total lines - do NOT " +
  "include them as items.\n" +
  "Return ONLY a JSON object (no markdown fences, no commentary) in this exact shape:\n" +
  '{"rawText": "<the full text of the receipt verbatim>", "items": [{"name": "<item name>", "price": <unit price as number>}]}\n' +
  "Use the item's line price (quantity x unit price) when a quantity is shown. " +
  "If a price is missing for an item, use 0.";

function extractJson(content: string): ParsedReceipt | null {
  // Strip markdown code fences if the model adds them
  const cleaned = content.replace(/```(?:json)?/g, "").trim();

  try {
    return JSON.parse(cleaned) as ParsedReceipt;
  } catch {
    // Fallback: grab the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as ParsedReceipt;
    } catch {
      return null;
    }
  }
}

export async function extractReceiptItems(
  imageUrl: string
): Promise<ParsedReceipt> {
  const dataUrl = await fetchImageAsBase64(imageUrl);

  const message = new HumanMessage({
    content: [
      { type: "text", text: EXTRACT_ITEMS_PROMPT },
      { type: "image_url", image_url: { url: dataUrl } },
    ],
  });

  const response = await itemModel.invoke([message]);

  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  const parsed = extractJson(content);

  if (!parsed || !Array.isArray(parsed.items)) {
    throw new Error("Failed to parse receipt items from image");
  }

  const items = parsed.items
    .filter(
      (item) =>
        item &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        typeof item.price === "number" &&
        !isNaN(item.price)
    )
    .map((item) => ({
      name: item.name.trim(),
      price: Math.max(0, item.price),
    }));

  if (items.length === 0) {
    throw new Error("No items found on receipt");
  }

  return {
    rawText:
      typeof parsed.rawText === "string" ? parsed.rawText : content,
    items,
  };
}
