"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import NumberFlow from "@number-flow/react";
import { TrendingUp, TrendingDown, Repeat, Calendar, Plus, AlertTriangle, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateTabStatus } from "./actions";

ChartJS.register(ArcElement, Tooltip, Legend);

// Contrasting color palette
const CHART_COLORS = [
  "hsl(210 70% 55%)",  // Blue
  "hsl(340 65% 55%)",  // Pink
  "hsl(45 85% 55%)",   // Yellow/Gold
  "hsl(160 50% 45%)",  // Teal
  "hsl(270 50% 55%)",  // Purple
  "hsl(25 80% 55%)",   // Orange
  "hsl(190 60% 45%)",  // Cyan
  "hsl(0 65% 55%)",    // Red
];

const CHART_BORDER_COLORS = [
  "hsl(210 70% 45%)",
  "hsl(340 65% 45%)",
  "hsl(45 85% 45%)",
  "hsl(160 50% 35%)",
  "hsl(270 50% 45%)",
  "hsl(25 80% 45%)",
  "hsl(190 60% 35%)",
  "hsl(0 65% 45%)",
];

type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  createdAt: Date | string;
  lender: {
    id: string;
    email: string;
    name: string | null;
  };
  borrower: {
    id: string;
    email: string;
    name: string | null;
  };
  group: {
    id: number;
    name: string;
  } | null;
};

type User = {
  id: string;
  email?: string;
};

type Group = {
  id: number;
  name: string;
  createdAt: Date | string;
  _count: {
    members: number;
  };
};

type Tab = {
  id: number;
  amount: number;
  description: string;
  personName: string;
  status: string;
  createdAt: Date | string;
};

type RecurringPayment = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  frequency: number;
  createdAt: Date | string;
  lender: {
    id: string;
    email: string;
    name: string;
  };
  borrowers: Array<{
    id: number;
    userId: string;
    splitPercentage: number;
    user: {
      id: string;
      email: string;
      name: string;
    };
  }>;
};

type Alert = {
  id: number;
  message: string | null;
  deadline: Date | string | null;
  isActive: boolean;
  createdAt: Date | string;
  lender: {
    id: string;
    email: string;
    name: string | null;
  };
  debt: {
    id: number;
    amount: number;
    description: string | null;
    status: string;
  } | null;
  recurringPayment: {
    id: number;
    amount: number;
    description: string | null;
    status: string;
  } | null;
  group: {
    id: number;
    name: string;
  } | null;
};

type DebtTransaction = {
  id: number;
  type: string;
  status: string;
  proposedAmount: number | null;
  proposedDescription: string | null;
  reason: string | null;
  createdAt: Date | string;
  requester: {
    id: string;
    email: string;
    name: string | null;
  };
  debt: {
    id: number;
    amount: number;
    description: string | null;
    lender: {
      id: string;
    };
    borrower: {
      id: string;
      email: string;
      name: string | null;
    };
  };
};

type DashboardPageClientProps = {
  initialDebts: Debt[];
  initialGroups: Group[];
  initialTabs: Tab[];
  currentUser: User;
  userName: string;
  initialRecurringPayments: RecurringPayment[];
  initialAlerts: Alert[];
  initialPendingTransactions: DebtTransaction[];
};

function getNextRenewalDate(payment: RecurringPayment): Date {
  const created = new Date(payment.createdAt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysSinceCreated = Math.floor(
    (today.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
  );
  const periodsElapsed = Math.max(0, Math.ceil(daysSinceCreated / payment.frequency));
  const nextRenewal = new Date(created);
  nextRenewal.setDate(created.getDate() + periodsElapsed * payment.frequency);

  // If next renewal is today or in the past, add one more period
  if (nextRenewal <= today) {
    nextRenewal.setDate(nextRenewal.getDate() + payment.frequency);
  }

  return nextRenewal;
}

function getDaysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

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
  const [debts] = useState<Debt[]>(initialDebts);
  const [groups] = useState<Group[]>(initialGroups);
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [recurringPayments] = useState<RecurringPayment[]>(initialRecurringPayments);
  const [alerts] = useState<Alert[]>(initialAlerts);
  const [pendingTransactions] = useState<DebtTransaction[]>(initialPendingTransactions);
  const [showOverdueBanner, setShowOverdueBanner] = useState(
    alerts.filter(a => a.debt !== null).length > 0
  );
  const [showPendingBanner, setShowPendingBanner] = useState(
    initialPendingTransactions.length > 0
  );
  const [error, setError] = useState("");
  const [chartView, setChartView] = useState<"owed" | "owing">("owed");
  const router = useRouter();

  const handleUpdateTabStatus = async (tabId: number, newStatus: string) => {
    const oldStatus = tabs.find((t) => t.id === tabId)?.status;

    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId ? { ...tab, status: newStatus } : tab
      )
    );

    try {
      const result = await updateTabStatus(tabId, newStatus);

      if (!result.success) {
        setError(result.error || "Failed to update tab status");
        if (oldStatus) {
          setTabs((prevTabs) =>
            prevTabs.map((tab) =>
              tab.id === tabId ? { ...tab, status: oldStatus } : tab
            )
          );
        }
        return;
      }
    } catch {
      setError("An error occurred while updating the tab status");
      if (oldStatus) {
        setTabs((prevTabs) =>
          prevTabs.map((tab) =>
            tab.id === tabId ? { ...tab, status: oldStatus } : tab
          )
        );
      }
    }
  };

  const lendingDebts = debts.filter(
    (debt) => debt.lender.id === currentUser?.id
  );
  const borrowingDebts = debts.filter(
    (debt) => debt.borrower.id === currentUser?.id
  );
  const activeTabs = tabs.filter(
    (tab) => tab.status === "lending" || tab.status === "borrowing"
  );

  const calculateTotal = (debtList: Debt[]) => {
    return debtList.reduce((sum, debt) => sum + debt.amount, 0);
  };

  // Upcoming recurring payments (due within 7 days)
  const upcomingPayments = useMemo(() => {
    return recurringPayments
      .map((payment) => ({
        ...payment,
        nextRenewal: getNextRenewalDate(payment),
        daysUntil: getDaysUntil(getNextRenewalDate(payment)),
      }))
      .filter((p) => p.daysUntil >= 0 && p.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [recurringPayments]);

  // Next renewal date (soonest)
  const nextRenewalDate = useMemo(() => {
    if (recurringPayments.length === 0) return null;

    const dates = recurringPayments.map((p) => getNextRenewalDate(p));
    const soonest = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
    return soonest;
  }, [recurringPayments]);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  // Chart data based on selected view
  const { chartData, chartDescriptions } = useMemo(() => {
    const relevantDebts =
      chartView === "owed"
        ? lendingDebts.filter((d) => d.status === "pending")
        : borrowingDebts.filter((d) => d.status === "pending");

    if (relevantDebts.length === 0) {
      return {
        chartData: {
          labels: [chartView === "owed" ? "No one owes you" : "You owe no one"],
          datasets: [
            {
              data: [1],
              backgroundColor: ["rgba(156, 163, 175, 0.3)"],
              borderColor: ["rgba(156, 163, 175, 0.5)"],
              borderWidth: 1,
            },
          ],
        },
        chartDescriptions: [] as string[][],
      };
    }

    // Group by person with descriptions
    const personData = new Map<string, { amount: number; descriptions: string[] }>();
    for (const debt of relevantDebts) {
      const personObj = chartView === "owed" ? debt.borrower : debt.lender;
      const person = personObj.name || personObj.email;
      const existing = personData.get(person) || { amount: 0, descriptions: [] };
      existing.amount += debt.amount;
      if (debt.description) {
        existing.descriptions.push(debt.description);
      } else if (debt.group?.name) {
        existing.descriptions.push(debt.group.name);
      }
      personData.set(person, existing);
    }

    const entries = Array.from(personData.entries()).sort(
      (a, b) => b[1].amount - a[1].amount
    );

    return {
      chartData: {
        labels: entries.map(([person]) => person),
        datasets: [
          {
            data: entries.map(([, data]) => data.amount),
            backgroundColor: entries.map(
              (_, i) => CHART_COLORS[i % CHART_COLORS.length]
            ),
            borderColor: entries.map(
              (_, i) => CHART_BORDER_COLORS[i % CHART_BORDER_COLORS.length]
            ),
            borderWidth: 2,
          },
        ],
      },
      chartDescriptions: entries.map(([, data]) => data.descriptions),
    };
  }, [chartView, lendingDebts, borrowingDebts]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "right" as const,
          labels: {
            boxWidth: 12,
            padding: 8,
            font: {
              size: 11,
            },
          },
        },
        tooltip: {
          callbacks: {
            title: (context: { label?: string }[]) => context[0]?.label || "",
            label: (context: { parsed: number; dataset: { data: number[] } }) => {
              const value = context.parsed;
              const total = context.dataset.data.reduce(
                (a: number, b: number) => a + b,
                0
              );
              const percentage = ((value / total) * 100).toFixed(1);
              return `$${value.toFixed(2)} (${percentage}%)`;
            },
            afterLabel: (context: { dataIndex: number }) => {
              const descriptions = chartDescriptions[context.dataIndex];
              if (!descriptions || descriptions.length === 0) return "";
              const truncate = (s: string, len: number) =>
                s.length > len ? s.slice(0, len) + "..." : s;
              const shown = descriptions.slice(0, 2).map((d) => `• ${truncate(d, 25)}`);
              if (descriptions.length > 2) {
                shown.push(`  +${descriptions.length - 2} more`);
              }
              return shown;
            },
          },
        },
      },
      cutout: "60%",
    }),
    [chartDescriptions]
  );

  const overduePayments = alerts.filter(a => a.debt !== null);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Notification Banners */}
      <div className="space-y-2">
        {/* Overdue Payments Banner */}
        {showOverdueBanner && overduePayments.length > 0 && (
          <div
            className="relative rounded-lg p-2.5 animate-in fade-in slide-in-from-top-4 duration-500 bg-red-500/10 border border-red-500/30"
          >
            <button
              onClick={() => setShowOverdueBanner(false)}
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-black/10 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2 pr-7">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-red-100">
                  You have {overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''}!
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Approvals Banner */}
        {showPendingBanner && pendingTransactions.length > 0 && (
          <div
            className="relative rounded-lg p-2.5 animate-in fade-in slide-in-from-top-4 duration-500 bg-emerald-500/10 border border-emerald-500/30"
          >
            <button
              onClick={() => setShowPendingBanner(false)}
              className="absolute top-2 right-2 p-1 rounded-md hover:bg-black/10 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-2 pr-7">
              <AlertTriangle className="h-4 w-4 text-emerald-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-emerald-100">
                  You have {pendingTransactions.length} transaction{pendingTransactions.length > 1 ? 's' : ''} waiting for your approval!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Welcome Section */}
      <div
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: "0ms", animationFillMode: "both" }}
      >
        <div className="flex items-center gap-4 sm:gap-6">
          <Image
            src="/mascot/mascot.png"
            alt="Mascot"
            width={100}
            height={100}
            className="shrink-0 w-16 h-16 sm:w-[100px] sm:h-[100px]"
          />
          <div className="space-y-0.5 sm:space-y-1 min-w-0">
            <h1 className="text-xl sm:text-3xl font-semibold tracking-tight">
              Welcome back, {userName}!
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Here&apos;s an overview of your debts and recurring payments
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/debts")} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add debt
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Four Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Card 1: You are owed */}
        <button
          type="button"
          onClick={() => setChartView("owed")}
          className={cn(
            "relative rounded-xl p-3 md:p-4 text-left transition-all animate-in fade-in slide-in-from-bottom-4 duration-500",
            chartView === "owed" ? "green-box-active" : "green-box"
          )}
          style={{ animationDelay: "100ms", animationFillMode: "both" }}
        >
          <TrendingUp className="absolute top-3 right-3 md:top-4 md:right-4 h-4 w-4 md:h-5 md:w-5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs md:text-sm text-emerald-700 dark:text-emerald-300">
            You are owed
          </p>
          <p className="text-lg md:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            <NumberFlow
              value={calculateTotal(lendingDebts)}
              format={{ style: "currency", currency: "USD" }}
            />
          </p>
        </button>

        {/* Card 2: You owe */}
        <button
          type="button"
          onClick={() => setChartView("owing")}
          className={cn(
            "relative rounded-xl p-3 md:p-4 text-left transition-all animate-in fade-in slide-in-from-bottom-4 duration-500",
            chartView === "owing" ? "red-box-active" : "red-box"
          )}
          style={{ animationDelay: "150ms", animationFillMode: "both" }}
        >
          <TrendingDown className="absolute top-3 right-3 md:top-4 md:right-4 h-4 w-4 md:h-5 md:w-5 text-rose-600 dark:text-rose-400" />
          <p className="text-xs md:text-sm text-rose-700 dark:text-rose-300">You owe</p>
          <p className="text-lg md:text-2xl font-bold text-rose-600 dark:text-rose-400">
            <NumberFlow
              value={calculateTotal(borrowingDebts)}
              format={{ style: "currency", currency: "USD" }}
            />
          </p>
        </button>

        {/* Card 3: Active recurring payments */}
        <div
          className="relative rounded-xl p-3 md:p-4 border bg-card/50 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "200ms", animationFillMode: "both" }}
        >
          <Repeat className="absolute top-3 right-3 md:top-4 md:right-4 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          <p className="text-xs md:text-sm text-muted-foreground">Active</p>
          <p className="text-lg md:text-2xl font-bold">
            <NumberFlow value={recurringPayments.length} />
          </p>
        </div>

        {/* Card 4: Next renewal date */}
        <div
          className="relative rounded-xl p-3 md:p-4 border bg-card/50 animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "250ms", animationFillMode: "both" }}
        >
          <Calendar className="absolute top-3 right-3 md:top-4 md:right-4 h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
          <p className="text-xs md:text-sm text-muted-foreground">Next renewal</p>
          <p className="text-lg md:text-2xl font-bold">
            {nextRenewalDate ? formatDate(nextRenewalDate) : "None"}
          </p>
        </div>
      </div>

      {/* Doughnut Chart & Upcoming Payments Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Doughnut Chart */}
        <Card
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "350ms", animationFillMode: "both" }}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {chartView === "owed" ? "Who owes you" : "Who you owe"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <Doughnut data={chartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Recurring Payments */}
        <Card
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "400ms", animationFillMode: "both" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Upcoming Payments</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/recurring")}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No payments due in the next 7 days
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {payment.description || "Recurring payment"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.daysUntil === 0
                          ? "Due today"
                          : payment.daysUntil === 1
                          ? "Due tomorrow"
                          : `Due in ${payment.daysUntil} days`}
                      </p>
                    </div>
                    <p className="font-semibold">
                      ${payment.amount.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Groups & Tabs Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Groups Card */}
        <Card
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "450ms", animationFillMode: "both" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Your Groups</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/groups")}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">No groups yet</p>
            ) : (
              <div className="space-y-3">
                {groups.slice(0, 3).map((group) => (
                  <div
                    key={group.id}
                    onClick={() => router.push(`/groups/${group.id}`)}
                    className="flex items-center justify-between rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <span className="font-medium">{group.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {group._count.members}{" "}
                      {group._count.members === 1 ? "member" : "members"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs Card */}
        <Card
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "500ms", animationFillMode: "both" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Your Tabs</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/tabs")}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {activeTabs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active tabs</p>
            ) : (
              <div className="space-y-3">
                {activeTabs.slice(0, 3).map((tab) => (
                  <div
                    key={tab.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tab.personName}</span>
                      <Badge
                        variant={
                          tab.status === "lending" ? "default" : "secondary"
                        }
                      >
                        {tab.status === "lending" ? "Owes you" : "You owe"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        ${tab.amount.toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateTabStatus(tab.id, "paid")}
                      >
                        Paid
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
