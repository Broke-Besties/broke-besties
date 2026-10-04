import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { paypalService } from "@/services/paypal.service";
import { receiptService } from "@/services/receipt.service";
import { notFound, redirect } from "next/navigation";
import DebtDetailClient from "./debt-detail-client";
import { parsePaypalReturn } from "./paypal";

export default async function DebtDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paypal?: string; pp?: string }>;
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

  const [receiptImageUrls, paypal, query] = await Promise.all([
    receiptService.getSignedImageUrls(debt.receipts.map((r) => r.id)),
    paypalService.getDebtPaypalInfo(
      debt,
      user.id,
      transactions.some((t) => t.status === "pending")
    ),
    searchParams,
  ]);

  return (
    <DebtDetailClient
      debt={debt}
      transactions={transactions}
      currentUserId={user.id}
      receiptImageUrls={receiptImageUrls}
      paypal={paypal}
      paypalReturn={parsePaypalReturn(query.paypal, query.pp)}
    />
  );
}
