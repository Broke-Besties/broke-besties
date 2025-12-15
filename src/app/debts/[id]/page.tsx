import { getUser } from "@/lib/supabase";
import { debtService } from "@/services/debt.service";
import { receiptService } from "@/services/receipt.service";
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
    const receipts = await receiptService.getDebtReceipts(debtId, user.id);

    return (
      <DebtDetailClient
        debt={debt}
        receipts={receipts}
        currentUserId={user.id}
      />
    );
  } catch (error) {

    redirect("/dashboard");
  }
}
