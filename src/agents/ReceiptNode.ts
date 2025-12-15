import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
});

export interface ReceiptState {
  imageUrl: string;
  rawText?: string;
  error?: string;
}

async function downloadImageAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");

  const contentType = response.headers.get("content-type") || "image/jpeg";

  return `data:${contentType};base64,${base64}`;
}

export async function receiptNode(
  state: ReceiptState
): Promise<Partial<ReceiptState>> {
  try {
    const imageDataUrl = await downloadImageAsBase64(state.imageUrl);

    const message = new HumanMessage({
      content: [
        {
          type: "image_url",
          image_url: imageDataUrl,
        },
        {
          type: "text",
          text: "Extract all text from this receipt image and return it as raw text. Include all visible text exactly as it appears, including dates, amounts, item names, and any other text.",
        },
      ],
    });

    const response = await model.invoke([message]);

    return {
      rawText:
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content),
    };
  } catch (error) {
    return {
      error: `Failed to parse receipt: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
