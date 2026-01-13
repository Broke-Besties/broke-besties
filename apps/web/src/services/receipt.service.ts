import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { ReceiptPolicy } from "@/policies";

export class ReceiptService {
  /**
   * Upload receipt image to Supabase storage and optionally link to debts
   * If no debtIds provided, creates a pending receipt (for AI flow)
   */
  async uploadAndParseReceipt(
    file: File,
    userId: string,
    debtIds?: number[]
  ) {
    // Use service role key to bypass RLS for storage operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // If debtIds provided, check permissions
    if (debtIds && debtIds.length > 0) {
      if (!(await ReceiptPolicy.canCreate(userId, debtIds))) {
        throw new Error(
          "Access denied - you must be lender or borrower on all specified debts"
        );
      }
    }

    // Create receipt record, optionally linking to debts
    const receipt = await prisma.receipt.create({
      data:
        debtIds && debtIds.length > 0
          ? { debts: { connect: debtIds.map((id) => ({ id })) } }
          : {},
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
   * Link an existing receipt to debts
   */
  async linkReceiptToDebts(
    receiptId: string,
    debtIds: number[],
    userId: string
  ) {
    // Verify receipt exists
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    // Verify user has access to all debts
    if (!(await ReceiptPolicy.canCreate(userId, debtIds))) {
      throw new Error(
        "Access denied - you must be lender or borrower on all specified debts"
      );
    }

    // Link receipt to debts
    await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        debts: {
          connect: debtIds.map((id) => ({ id })),
        },
      },
    });

    return { success: true };
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

    // For pending receipts (no debts), allow the uploader to view
    // For linked receipts, check if user is lender/borrower on any debt
    if (receipt.debts.length > 0 && !ReceiptPolicy.canView(userId, receipt)) {
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
    const receipt = await prisma.receipt.findFirst({
      where: { id: receiptId },
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

    // For pending receipts or receipts the user has access to
    if (receipt.debts.length > 0 && !ReceiptPolicy.canDelete(userId, receipt)) {
      throw new Error("Access denied");
    }

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
