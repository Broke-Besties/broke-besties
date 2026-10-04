import { prisma } from "@/lib/prisma";
import { getNavCounts } from "@/lib/nav-counts";
import { alertService } from "@/services/alert.service";
import { debtService } from "@/services/debt.service";
import { debtTransactionService } from "@/services/debt-transaction.service";
import { groupService } from "@/services/group.service";
import { recurringPaymentService } from "@/services/recurring-payment.service";
import { tabService } from "@/services/tab.service";

/**
 * Everything the home screen shows. Shared by the dashboard page and
 * GET /api/dashboard so the two can't drift apart.
 */
export async function getDashboardData(user: { id: string; email?: string | null }) {
  const [dbUser, debts, groups, tabs, recurringPayments, alerts, pendingTransactions, counts] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, name: true },
      }),
      debtService.getUserDebts(user.id, { status: "pending" }),
      groupService.getUserGroups(user.id),
      tabService.getUserTabs(user.id),
      recurringPaymentService.getUserRecurringPayments(user.id, { status: "active" }),
      alertService.getActiveAlertsForBorrower(user.id),
      debtTransactionService.getUserPendingTransactions(user.id),
      getNavCounts(user.id, user.email ?? ""),
    ]);

  return {
    user: dbUser ?? { id: user.id, email: user.email ?? "", name: null },
    debts,
    groups,
    tabs,
    recurringPayments,
    alerts,
    // Requests waiting on the user's approval as the lender
    pendingApprovals: pendingTransactions.filter(
      (transaction) => transaction.debt.lenderId === user.id && !transaction.lenderApproved
    ),
    counts,
  };
}
