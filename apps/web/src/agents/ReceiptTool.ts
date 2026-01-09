import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase";

const ocrModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
});

async function fetchImageAsBase64(imageUrl: string): Promise<string> {

  // Check if it's a Supabase storage URL
  if (imageUrl.includes("supabase")) {
    try {
      // Extract the bucket and path from the URL
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split("/storage/v1/object/sign/");

      if (pathParts.length === 2) {
        const [bucket, ...pathSegments] = pathParts[1].split("/");
        const filePath = pathSegments.join("/").split("?")[0]; // Remove query params

        const supabase = createAdminClient();
        const { data, error } = await supabase.storage
          .from(bucket)
          .download(filePath);

        if (error) {
          console.error("[Receipt Tool] Supabase download error:", error);
          throw new Error(`Failed to download from Supabase: ${error.message}`);
        }

        // Convert blob to base64
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString("base64");

        const mimeType = data.type || "image/jpeg";

        return `data:${mimeType};base64,${base64}`;
      }
    } catch (error) {
      console.error("[Receipt Tool] Error parsing Supabase URL:", error);
    }
  }

  // Fallback: fetch from regular URL
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const mimeType = response.headers.get("content-type") || "image/jpeg";

  return `data:${mimeType};base64,${base64}`;
}

export const extractReceiptTextTool = tool(
  async ({
    imageUrl,
  }: {
    imageUrl: string;
  }) => {
    try {
      const dataUrl = await fetchImageAsBase64(imageUrl);

      const message = new HumanMessage({
        content: [
          {
            type: "text",
            text:
              "Extract all text from this receipt image and return it as raw text. " +
              "Include all visible text exactly as it appears, including dates, amounts, item names, and any other text. " +
              "Format the output clearly with line breaks between different sections.",
          },
          {
            type: "image_url",
            image_url: {
              url: dataUrl,
            },
          },
        ],
      });

      const response = await ocrModel.invoke([message]);

      const extractedText =
        typeof response.content === "string"
          ? response.content
          : JSON.stringify(response.content);

      console.log("[Receipt Tool] Extracted text:", extractedText);

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
      "Extracts ALL text from a receipt image using OCR. Returns the complete receipt text including item names, prices, totals, and other details.",
    schema: z.object({
      imageUrl: z.string().describe("The URL of the receipt image to process"),
    }),
  }
);
