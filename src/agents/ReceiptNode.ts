import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const ocrModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
});

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

export const extractReceiptTextTool = tool(
  async ({ imageUrl }: { imageUrl: string }) => {
    try {
      const imageDataUrl = await downloadImageAsBase64(imageUrl);

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

      const response = await ocrModel.invoke([message]);

      const extractedText =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      return extractedText;
    } catch (error) {
      throw new Error(
        `Failed to extract receipt text: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
  {
    name: "extract_receipt_text",
    description:
      "Extracts text from a receipt image using OCR. Use this when you need to read text from a receipt image URL.",
    schema: z.object({
      imageUrl: z.string().describe("The URL of the receipt image to process"),
    }),
  }
);
