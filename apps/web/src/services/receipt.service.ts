import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { ReceiptPolicy } from "@/policies";

export class ReceiptService {
  /**
   * Upload receipt image to Supabase storage and link to debts
   */
  async uploadAndParseReceipt(file: File, debtIds: number[], userId: string) {
    // Use service role key to bypass RLS for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Validate that at least one debt is provided
    if (debtIds.length === 0) {
      throw new Error("At least one debt ID is required");
    }

    // Check if user can create receipt (must be lender/borrower on all debts)
    if (!(await ReceiptPolicy.canCreate(userId, debtIds))) {
      throw new Error(
        "Access denied - you must be lender or borrower on all specified debts"
      );
    }

    // Create receipt record and link to debts
    const receipt = await prisma.receipt.create({
      data: {
        debts: {
          connect: debtIds.map((id) => ({ id })),
        },
      },
    });

    try {
      // Flat storage path: receipts/{receiptId}
      const storagePath = `receipts/${receipt.id}`;

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

      return {
        id: receipt.id,
        signedUrl: signedUrlData.signedUrl,
      };
    } catch (error) {
      await prisma.receipt
        .delete({ where: { id: receipt.id } })
        .catch(() => {});
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
        debts: {
          select: {
            id: true,
            lenderId: true,
            borrowerId: true,
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
   * Get all receipts for a specific debt
   */
  async getReceiptsForDebt(debtId: number, userId: string) {
    // First verify user has access to the debt
    const debt = await prisma.debt.findFirst({
      where: {
        id: debtId,
        OR: [{ lenderId: userId }, { borrowerId: userId }],
      },
      include: {
        receipts: true,
      },
    });

    if (!debt) {
      throw new Error("Debt not found or access denied");
    }

    return debt.receipts;
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

    // Flat storage path: receipts/{receiptId}
    const storagePath = `receipts/${receiptId}`;
    await supabase.storage.from("receipts").remove([storagePath]);

    // Delete from database
    await prisma.receipt.delete({
      where: { id: receiptId },
    });

    return { success: true };
  }
}

export const receiptService = new ReceiptService();
