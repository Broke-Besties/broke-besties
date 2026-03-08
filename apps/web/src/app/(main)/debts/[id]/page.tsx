import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
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
    // Fetch debt with receipts
    const debt = await debtService.getDebtById(debtId, user.id);

    // Fetch pending transactions for this debt
    const transactions = await debtTransactionService.getDebtTransactions(
      debtId,
      user.id
    );
    console.log("transactions", transactions);

    // Get signed URLs for receipts if they exist
    const receiptImageUrls: { id: string; url: string }[] = [];
    if (debt.receipts && debt.receipts.length > 0) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      for (const receipt of debt.receipts) {
        // Flat storage path: receipts/{receiptId}
        const storagePath = `receipts/${receipt.id}`;
        console.log(
          "[Debt Detail] Fetching receipt from storage path:",
          storagePath
        );

        const { data: signedUrlData, error: signedUrlError } =
          await supabase.storage
            .from("receipts")
            .createSignedUrl(storagePath, 3600); // 1 hour expiry

        if (signedUrlError) {
          console.error(
            "[Debt Detail] Error creating signed URL:",
            signedUrlError
          );
        }

        if (signedUrlData) {
          receiptImageUrls.push({
            id: receipt.id,
            url: signedUrlData.signedUrl,
          });
          console.log("[Debt Detail] Receipt image URL generated successfully");
        }
      }
    }

    return (
      <DebtDetailClient
        debt={debt}
        receipts={debt.receipts || []}
        transactions={transactions}
        currentUserId={user.id}
        receiptImageUrls={receiptImageUrls}
      />
    );
  } catch (error) {
    console.error("Error fetching debt:", error);
    redirect("/dashboard");
  }
}
