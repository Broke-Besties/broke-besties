import { createClient } from "@supabase/supabase-js";
import { agent } from "@/agents/graph";
import { prisma } from "@/lib/prisma";
import { HumanMessage } from "@langchain/core/messages";
import { ReceiptPolicy } from "@/policies";

export class ReceiptService {
  /**
   * Upload receipt image to Supabase storage and parse it with AI
   */
  async uploadAndParseReceipt(
    file: File,
    groupId: number,
    userId: string,
    debtId?: number
  ) {
    // Use service role key to bypass RLS for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user can create receipt (policy handles the DB call)
    if (!await ReceiptPolicy.canCreate(userId, groupId)) {
      throw new Error("Group not found or access denied");
    }

    // Create receipt record first to get the ID
    const receipt = await prisma.receipt.create({
      data: {
        groupId,
      },
    });

    try {
      const storagePath = `group/${groupId}/receipts/${receipt.id}`;

      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        await prisma.receipt.delete({ where: { id: receipt.id } });
        throw new Error(`Failed to upload receipt: ${uploadError.message}`);
      }

      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from("receipts")
          .createSignedUrl(storagePath, 3600);

      if (signedUrlError || !signedUrlData) {
        throw new Error(`Failed to get signed URL: ${signedUrlError?.message}`);
      }

      console.log("[Receipt Upload] Successfully uploaded to Supabase");
      console.log("[Receipt Upload] Presigned URL:", signedUrlData.signedUrl);

      // Convert file to base64 for the agent (avoids fetching the URL back)
      const arrayBuffer = await file.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const imageBase64 = `data:${file.type};base64,${base64}`;

      const result = await agent.invoke({
        groupId,
        imageUrl: signedUrlData.signedUrl,
        imageBase64,
        messages: [
          new HumanMessage("Please extract all information from the receipt."),
        ],
      });

      // Extract text from the tool message in the conversation
      const toolMessage = result.messages.find(
        (msg: any) => msg.constructor.name === "ToolMessage"
      );
      const extractedText = toolMessage
        ? typeof toolMessage.content === "string"
          ? toolMessage.content
          : JSON.stringify(toolMessage.content)
        : "";

      const updatedReceipt = await prisma.receipt.update({
        where: { id: receipt.id },
        data: { rawText: extractedText },
      });

      // If debtId is provided, link the receipt to the debt
      if (debtId) {
        await prisma.debt.update({
          where: { id: debtId },
          data: { receiptId: receipt.id },
        });
      }

      return {
        id: updatedReceipt.id,
        signedUrl: signedUrlData.signedUrl,
        rawText: extractedText,
      };
    } catch (error) {
      await prisma.receipt.delete({ where: { id: receipt.id } }).catch(() => {});
      throw error;
    }
  }

  /**
   * Get receipt by ID
   */
  async getReceiptById(receiptId: string, userId: string) {
    const receipt = await prisma.receipt.findFirst({
      where: {
        id: receiptId,
      },
      include: {
        group: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    // Check permission using the fetched receipt object
    if (!ReceiptPolicy.canView(userId, receipt)) {
      throw new Error("Access denied");
    }

    return receipt;
  }

  /**
   * Get all receipts for a group
   */
  async getGroupReceipts(groupId: number, userId: string) {
    // Check if user can list group receipts (policy handles the DB call)
    if (!await ReceiptPolicy.canListGroupReceipts(userId, groupId)) {
      throw new Error("Group not found or access denied");
    }

    return prisma.receipt.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Delete receipt from storage and database
   */
  async deleteReceipt(receiptId: string, userId: string) {
    const receipt = await this.getReceiptById(receiptId, userId);
    // Use service role key to bypass RLS for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find the file in storage (try common extensions)
    const storagePath = `group/${receipt.groupId}/receipts/${receiptId}`;
    await supabase.storage.from("receipts").remove([storagePath]);

    // Delete from database
    await prisma.receipt.delete({
      where: { id: receiptId },
    });

    return { success: true };
  }
}

export const receiptService = new ReceiptService();
