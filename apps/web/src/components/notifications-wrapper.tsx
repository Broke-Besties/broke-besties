import { getUser } from "@/lib/supabase";
import { alertService } from "@/services/alert.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { NotificationsDropdown } from "./notifications-dropdown";

export async function NotificationsWrapper() {
  const user = await getUser();

  if (!user) {
    return null;
  }

  const [alerts, pendingTransactions] = await Promise.all([
    alertService.getActiveAlertsForBorrower(user.id),
    debtTransactionService.getUserPendingTransactions(user.id),
  ]);

  // Filter pending transactions where current user is the lender (needs to approve)
  const pendingApprovals = pendingTransactions.filter(
    (transaction) =>
      transaction.debt.lenderId === user.id && !transaction.lenderApproved
  );

  return (
    <NotificationsDropdown
      alerts={alerts}
      pendingTransactions={pendingApprovals}
      currentUserId={user.id}
    />
  );
}

