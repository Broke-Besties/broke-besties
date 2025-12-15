import { createClient } from "@supabase/supabase-js";
import { agent } from "@/agents/graph";
import { prisma } from "@/lib/prisma";

export class ReceiptService {
  /**
   * Upload receipt image to Supabase storage and parse it with AI
   */
  async uploadAndParseReceipt(file: File, debtId: number, userId: string) {
    // Use service role key to bypass RLS for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify debt exists and user has access to it
    const debt = await prisma.debt.findFirst({
      where: {
        id: debtId,
        OR: [{ lenderId: userId }, { borrowerId: userId }],
      },
    });

    if (!debt) {
      throw new Error("Debt not found or access denied");
    }

    // Create receipt record first to get the ID
    const receipt = await prisma.receipt.create({
      data: {
        debtId,
      },
    });

    try {
      // Get file extension
      const extension = file.name.split(".").pop() || "jpg";
      const storagePath = `${receipt.id}.${extension}`;

      // Upload to Supabase storage using receipt ID
      const { error: uploadError } = await supabase.storage
        .from("receipts")
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        // Clean up receipt record if upload fails
        await prisma.receipt.delete({ where: { id: receipt.id } });
        throw new Error(`Failed to upload receipt: ${uploadError.message}`);
      }

      // Get signed URL (valid for 1 hour)
      const { data: signedUrlData, error: signedUrlError } =
        await supabase.storage
          .from("receipts")
          .createSignedUrl(storagePath, 3600);

      if (signedUrlError || !signedUrlData) {
        throw new Error(`Failed to get signed URL: ${signedUrlError?.message}`);
      }

      // Parse receipt with AI agent
      const result = await agent.invoke({
        imageUrl: signedUrlData.signedUrl,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      // Update receipt with parsed text
      const updatedReceipt = await prisma.receipt.update({
        where: { id: receipt.id },
        data: { rawText: result.rawText },
      });

      return {
        id: updatedReceipt.id,
        signedUrl: signedUrlData.signedUrl,
        rawText: updatedReceipt.rawText,
      };
    } catch (error) {
      // Clean up on any error
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
        debt: {
          OR: [{ lenderId: userId }, { borrowerId: userId }],
        },
      },
      include: {
        debt: true,
      },
    });

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    return receipt;
  }

  /**
   * Get all receipts for a debt
   */
  async getDebtReceipts(debtId: number, userId: string) {
    // Verify user has access to the debt
    const debt = await prisma.debt.findFirst({
      where: {
        id: debtId,
        OR: [{ lenderId: userId }, { borrowerId: userId }],
      },
    });

    if (!debt) {
      throw new Error("Debt not found or access denied");
    }

    return prisma.receipt.findMany({
      where: { debtId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Delete receipt from storage and database
   */
  async deleteReceipt(receiptId: string, userId: string) {
    await this.getReceiptById(receiptId, userId);
    // Use service role key to bypass RLS for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find the file in storage (try common extensions)
    const extensions = ["jpg", "jpeg", "png", "webp"];
    for (const ext of extensions) {
      const storagePath = `${receiptId}.${ext}`;
      await supabase.storage.from("receipts").remove([storagePath]);
    }

    // Delete from database
    await prisma.receipt.delete({
      where: { id: receiptId },
    });

    return { success: true };
  }
}

export const receiptService = new ReceiptService();
