"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { CreateDebtModal } from "@/app/(app)/debts/create-debt-modal";
import { ActivityChart } from "./activity-chart";
import { DebtBreakdown } from "./debt-breakdown";
import { GroupsCard, TabsCard, UpcomingPaymentsCard } from "./list-cards";
import { NeedsAttention } from "./needs-attention";
import { StatCards } from "./stat-cards";
import { updateTabStatus } from "./actions";
import { getDaysUntil, getNextRenewalDate } from "./format";
import type {
  DashboardUser,
  Debt,
  Group,
  OverdueAlert,
  PendingTransaction,
  RecurringPayment,
  Tab,
} from "./types";

type DashboardPageClientProps = {
  initialDebts: Debt[];
  initialGroups: Group[];
  initialTabs: Tab[];
  currentUser: DashboardUser;
  userName: string;
  initialRecurringPayments: RecurringPayment[];
  initialAlerts: OverdueAlert[];
  initialPendingTransactions: PendingTransaction[];
};

export default function DashboardPageClient({
  initialDebts,
  initialGroups,
  initialTabs,
  currentUser,
  userName,
  initialRecurringPayments,
  initialAlerts,
  initialPendingTransactions,
}: DashboardPageClientProps) {
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [showCreateDebt, setShowCreateDebt] = useState(false);

  const lendingDebts = initialDebts.filter(
    (debt) => debt.lender.id === currentUser.id
  );
  const borrowingDebts = initialDebts.filter(
    (debt) => debt.borrower.id === currentUser.id
  );
  const activeTabs = tabs.filter(
    (tab) => tab.status === "lending" || tab.status === "borrowing"
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

  const handleMarkTabPaid = async (tabId: number) => {
    const oldStatus = tabs.find((tab) => tab.id === tabId)?.status;

    setTabs((prev) =>
      prev.map((tab) => (tab.id === tabId ? { ...tab, status: "paid" } : tab))
    );

    const revert = () => {
      if (oldStatus) {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === tabId ? { ...tab, status: oldStatus } : tab
          )
        );
      }
    };

    try {
      const result = await updateTabStatus(tabId, "paid");
      if (result.success) {
        toast.success("Tab marked as paid");
      } else {
        toast.error(result.error || "Failed to update tab status");
        revert();
      }
    } catch {
      toast.error("An error occurred while updating the tab status");
      revert();
    }
  };

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
        <TabsCard
          tabs={activeTabs}
          totalActive={activeTabs.length}
          onMarkPaid={handleMarkTabPaid}
        />
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
