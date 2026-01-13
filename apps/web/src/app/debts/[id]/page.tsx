import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { receiptService } from "@/services/receipt.service";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DebtDetailClient from "./debt-detail-client";
import { createClient } from "@supabase/supabase-js";

export default async function DebtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const debtId = parseInt(id, 10);

  if (isNaN(debtId)) {
    redirect("/dashboard");
  }
  try {
    const debt = await debtService.getDebtById(debtId, user.id);

    // Fetch debt with receipt if linked
    const debtWithReceipt = await prisma.debt.findUnique({
      where: { id: debtId },
      include: {
        lender: { select: { id: true, email: true } },
        borrower: { select: { id: true, email: true } },
        group: { select: { id: true, name: true } },
        receipt: { select: { id: true, rawText: true, groupId: true } },
      },
    });

    // Only fetch receipts if debt has a group
    const receipts = debt.groupId
      ? await receiptService.getGroupReceipts(debt.groupId, user.id)
      : [];

    // Fetch pending transactions for this debt
    const transactions = await debtTransactionService.getDebtTransactions(debtId, user.id);
    console.log('transactions', transactions);

    // Get signed URL for receipt if it exists
    let receiptImageUrl: string | null = null;
    if (debtWithReceipt?.receipt) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const storagePath = `group/${debtWithReceipt.receipt.groupId}/receipts/${debtWithReceipt.receipt.id}`;
      console.log('[Debt Detail] Fetching receipt from storage path:', storagePath);

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from("receipts")
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (signedUrlError) {
        console.error('[Debt Detail] Error creating signed URL:', signedUrlError);
      }

      if (signedUrlData) {
        receiptImageUrl = signedUrlData.signedUrl;
        console.log('[Debt Detail] Receipt image URL generated successfully');
      } else {
        console.log('[Debt Detail] No signed URL data returned');
      }
    }

    return (
      <DebtDetailClient
        debt={debtWithReceipt || debt}
        receipts={receipts}
        transactions={transactions}
        currentUserId={user.id}
        receiptImageUrl={receiptImageUrl}
      />
    );
  } catch (error) {
    console.error("Error fetching debt:", error);
    redirect("/dashboard");
  }
}
