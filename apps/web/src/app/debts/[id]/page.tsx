import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { receiptService } from "@/services/receipt.service";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
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
        receipt: { select: { id: true, rawText: true } },
      },
    });

    const receipts = await receiptService.getGroupReceipts(debt.groupId, user.id);

    // Fetch pending transactions for this debt
    const transactions = await debtTransactionService.getDebtTransactions(debtId, user.id);

    return (
      <DebtDetailClient
        debt={debtWithReceipt || debt}
        receipts={receipts}
        transactions={transactions}
        currentUserId={user.id}
      />
    );
  } catch (error) {
    console.error("Error fetching debt:", error);
    redirect("/dashboard");
  }
}
