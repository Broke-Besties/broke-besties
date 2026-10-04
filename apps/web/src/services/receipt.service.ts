import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import { ReceiptPolicy } from "@/policies";
import { extractReceiptItems } from "@/agents/ReceiptItemParser";

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

    // Record the uploader up front: a receipt with no uploader and no debts is
    // readable by anyone (legacy rule), even for the length of the upload.
    const receipt = await prisma.receipt.create({
      data: {
        uploaderId: userId,
        ...(debtIds && debtIds.length > 0
          ? { debts: { connect: debtIds.map((id) => ({ id })) } }
          : {}),
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
   * Link an existing receipt to debts
   */
  async linkReceiptToDebts(
    receiptId: string,
    debtIds: number[],
    userId: string
  ) {
    const receipt = await prisma.receipt.findUnique({
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

    // Only the uploader or a party on an already-linked debt may link; otherwise
    // anyone could attach someone else's receipt to their own debt and read it
    if (receipt.uploaderId !== userId && !ReceiptPolicy.canView(userId, receipt)) {
      throw new Error("Access denied");
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
        items: {
          orderBy: {
            createdAt: "asc",
          },
        },
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

    if (!(await this.canAccessReceipt(userId, receipt))) {
      throw new Error("Access denied");
    }

    return receipt;
  }

  /**
   * Run item extraction on a receipt image and persist the parsed
   * items (name + price) along with the raw OCR text.
   * Items are re-extracted and replace any previously parsed items.
   */
  async parseReceiptItems(receiptId: string, userId: string) {
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

    if (!(await this.canAccessReceipt(userId, receipt))) {
      throw new Error("Access denied");
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from("receipts")
        .createSignedUrl(`receipts/${receiptId}`, 3600);

    if (signedUrlError || !signedUrlData) {
      throw new Error(
        `Failed to get signed URL: ${signedUrlError?.message}`
      );
    }

    const parsed = await extractReceiptItems(signedUrlData.signedUrl);

    // Replace any previously parsed items and persist the OCR text
    await prisma.$transaction([
      prisma.receiptItem.deleteMany({ where: { receiptId } }),
      prisma.receipt.update({
        where: { id: receiptId },
        data: {
          rawText: parsed.rawText,
          items: {
            create: parsed.items.map((item) => ({
              name: item.name,
              price: item.price,
            })),
          },
        },
      }),
    ]);

    return {
      id: receiptId,
      rawText: parsed.rawText,
      items: parsed.items,
    };
  }

  /**
   * Get the parsed items for a receipt
   */
  async getReceiptItems(receiptId: string, userId: string) {
    await this.getReceiptById(receiptId, userId);

    return prisma.receiptItem.findMany({
      where: { receiptId },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Users can access a receipt if they uploaded it (pending receipts)
   * or are the lender/borrower on any of its linked debts.
   */
  private async canAccessReceipt(
    userId: string,
    receipt: { uploaderId: string | null; debts: { id: number; lenderId: string; borrowerId: string }[] }
  ) {
    if (receipt.uploaderId === userId) {
      return true;
    }

    // Legacy receipts uploaded before uploader tracking
    if (!receipt.uploaderId && receipt.debts.length === 0) {
      return true;
    }

    return receipt.debts.length > 0 && ReceiptPolicy.canView(userId, receipt);
  }

  /**
   * Signed (1-hour) URLs for receipt images stored at `receipts/{id}`, in input
   * order. Receipts whose URL can't be created are skipped (and logged); never throws.
   */
  async getSignedImageUrls(
    receiptIds: string[]
  ): Promise<{ id: string; url: string }[]> {
    if (receiptIds.length === 0) {
      return [];
    }

    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const urls = await Promise.all(
        receiptIds.map(async (id) => {
          const { data, error } = await supabase.storage
            .from("receipts")
            .createSignedUrl(`receipts/${id}`, 3600)
            .catch((error) => ({ data: null, error }));

          if (error || !data) {
            console.error(`[Receipt URLs] Error signing receipts/${id}:`, error);
            return [];
          }
          return [{ id, url: data.signedUrl }];
        })
      );

      return urls.flat();
    } catch (error) {
      console.error("[Receipt URLs] Error creating storage client:", error);
      return [];
    }
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

    // Pending receipts (no debts yet) belong to whoever uploaded them
    if (
      receipt.debts.length === 0 &&
      receipt.uploaderId &&
      receipt.uploaderId !== userId
    ) {
      throw new Error("Access denied");
    }

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
