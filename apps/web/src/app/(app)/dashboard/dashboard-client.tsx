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
  asOf: number;
  initialDebts: Debt[];
  initialGroups: Group[];
  currentUser: DashboardUser;
  userName: string;
  initialRecurringPayments: RecurringPayment[];
  initialAlerts: OverdueAlert[];
  initialPendingTransactions: PendingTransaction[];
};

export default function DashboardPageClient({
  asOf,
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
    (debt) => debt.lender.id === currentUser.id,
  );
  const borrowingDebts = initialDebts.filter(
    (debt) => debt.borrower.id === currentUser.id,
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
    [initialRecurringPayments],
  );

  return (
    <div className="flex flex-col gap-6">
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

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <StatCards
            lendingTotal={lendingDebts.reduce(
              (sum, debt) => sum + debt.amount,
              0,
            )}
            borrowingTotal={borrowingDebts.reduce(
              (sum, debt) => sum + debt.amount,
              0,
            )}
          />
          <ActivityChart debts={initialDebts} currentUserId={currentUser.id} />
          <DebtBreakdown
            lendingDebts={lendingDebts}
            borrowingDebts={borrowingDebts}
          />
          <UpcomingPaymentsCard
            payments={upcomingPayments}
            activeCount={initialRecurringPayments.length}
          />
        </div>
        <aside
          aria-label="Requests and groups"
          className="flex min-w-0 flex-col gap-6"
        >
          <NeedsAttention
            asOf={asOf}
            pendingTransactions={initialPendingTransactions}
            alerts={initialAlerts}
          />
          <GroupsCard groups={initialGroups} />
        </aside>
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
