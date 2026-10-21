import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { receiptService } from "@/services/receipt.service";
import { notFound, redirect } from "next/navigation";
import DebtDetailClient from "./debt-detail-client";

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
    notFound();
  }

  let debt: Awaited<ReturnType<typeof debtService.getDebtById>>;
  let transactions: Awaited<
    ReturnType<typeof debtTransactionService.getDebtTransactions>
  >;
  try {
    debt = await debtService.getDebtById(debtId, user.id);
    transactions = await debtTransactionService.getDebtTransactions(
      debtId,
      user.id
    );
  } catch (error) {
    console.error("Error fetching debt:", error);
    notFound();
  }

  const receiptImageUrls = await receiptService.getSignedImageUrls(
    debt.receipts.map((r) => r.id)
  );

  return (
    <DebtDetailClient
      debt={debt}
      transactions={transactions}
      currentUserId={user.id}
      receiptImageUrls={receiptImageUrls}
    />
  );
}
