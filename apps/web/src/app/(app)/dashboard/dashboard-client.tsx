"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { CreateDebtModal } from "@/app/(app)/debts/create-debt-modal";
import { ActivityChart } from "./activity-chart";
import { DebtBreakdown } from "./debt-breakdown";
import { GroupsCard, UpcomingPaymentsCard } from "./list-cards";
import { NeedsAttention } from "./needs-attention";
import { StatCards } from "./stat-cards";
import { getDaysUntil, getNextRenewalDate } from "./format";
import type {
  DashboardUser,
  Debt,
  Group,
  OverdueAlert,
  PendingTransaction,
  RecurringPayment,
} from "./types";

type DashboardPageClientProps = {
  initialDebts: Debt[];
  initialGroups: Group[];
  currentUser: DashboardUser;
  userName: string;
  initialRecurringPayments: RecurringPayment[];
  initialAlerts: OverdueAlert[];
  initialPendingTransactions: PendingTransaction[];
};

export default function DashboardPageClient({
  initialDebts,
  initialGroups,
  currentUser,
  userName,
  initialRecurringPayments,
  initialAlerts,
  initialPendingTransactions,
}: DashboardPageClientProps) {
  const router = useRouter();
  const [showCreateDebt, setShowCreateDebt] = useState(false);

  const lendingDebts = initialDebts.filter(
    (debt) => debt.lender.id === currentUser.id
  );
  const borrowingDebts = initialDebts.filter(
    (debt) => debt.borrower.id === currentUser.id
  );

  const upcomingPayments = useMemo(
    () =>
      initialRecurringPayments
        .map((payment) => ({
          ...payment,
          daysUntil: getDaysUntil(getNextRenewalDate(payment)),
        }))
        .filter((payment) => payment.daysUntil >= 0 && payment.daysUntil <= 7)
        .sort((a, b) => a.daysUntil - b.daysUntil),
    [initialRecurringPayments]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${userName}`}
        description="An overview of your debts and recurring payments"
        actions={
          <Button onClick={() => setShowCreateDebt(true)}>
            <Plus />
            Add debt
          </Button>
        }
      />

      <NeedsAttention
        pendingTransactions={initialPendingTransactions}
        alerts={initialAlerts}
      />

      <StatCards
        lendingTotal={lendingDebts.reduce((sum, debt) => sum + debt.amount, 0)}
        borrowingTotal={borrowingDebts.reduce(
          (sum, debt) => sum + debt.amount,
          0
        )}
        recurringPayments={initialRecurringPayments}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <DebtBreakdown
          lendingDebts={lendingDebts}
          borrowingDebts={borrowingDebts}
        />
        <UpcomingPaymentsCard payments={upcomingPayments} />
      </div>

      <ActivityChart debts={initialDebts} currentUserId={currentUser.id} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <GroupsCard groups={initialGroups} />
      </div>

      <CreateDebtModal
        isOpen={showCreateDebt}
        onClose={() => setShowCreateDebt(false)}
        onSuccess={() => {
          setShowCreateDebt(false);
          router.refresh();
        }}
        currentUserId={currentUser.id}
      />
    </div>
  );
}
