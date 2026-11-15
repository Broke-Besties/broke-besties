import { getUser } from "@/lib/supabase";
import { alertService } from "@/services/alert.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { NotificationsDropdown } from "./notifications-dropdown";
import type { NavCounts } from "@/lib/nav";

export async function NotificationsWrapper({
  counts,
}: { counts?: NavCounts } = {}) {
  const user = await getUser();

  if (!user) {
    return null;
  }

  const [alerts, pendingTransactions] = await Promise.all([
    alertService.getActiveAlertsForBorrower(user.id),
    debtTransactionService.getUserPendingTransactions(user.id),
  ]);

  const pendingApprovals = pendingTransactions.filter(
    (transaction) =>
      (transaction.debt.lenderId === user.id && !transaction.lenderApproved) ||
      (transaction.debt.borrowerId === user.id &&
        !transaction.borrowerApproved),
  );
  const now = new Date().getTime();
  const overdueAlerts = alerts.filter(
    (alert) =>
      alert.isActive &&
      alert.debt?.status === "pending" &&
      alert.deadline !== null &&
      new Date(alert.deadline).getTime() < now,
  );

  return (
    <NotificationsDropdown
      alerts={overdueAlerts}
      pendingTransactions={pendingApprovals}
      friendRequests={counts?.friendRequests ?? 0}
      groupInvites={counts?.invites ?? 0}
    />
  );
}
