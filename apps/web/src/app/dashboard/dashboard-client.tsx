"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateDebtStatus, updateTabStatus } from "./actions";

ChartJS.register(ArcElement, Tooltip, Legend);

// Blue/slate color palette
const CHART_COLORS = [
  "hsl(210 45% 70%)",
  "hsl(210 35% 60%)",
  "hsl(215 30% 50%)",
  "hsl(220 25% 40%)",
  "hsl(215 20% 35%)",
  "hsl(205 40% 65%)",
  "hsl(200 30% 55%)",
  "hsl(225 20% 45%)",
];

const CHART_BORDER_COLORS = [
  "hsl(210 45% 60%)",
  "hsl(210 35% 50%)",
  "hsl(215 30% 40%)",
  "hsl(220 25% 30%)",
  "hsl(215 20% 25%)",
  "hsl(205 40% 55%)",
  "hsl(200 30% 45%)",
  "hsl(225 20% 35%)",
];

type Debt = {
  id: number
  amount: number
  description: string | null
  status: string
  createdAt: Date | string
  lender: {
    id: string;
    email: string;
  };
  borrower: {
    id: string;
    email: string;
  };
  group: {
    id: number;
    name: string;
  } | null;
};

type User = {
  id: string;
  email: string;
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

type DashboardPageClientProps = {
  initialDebts: any[];
  initialGroups: any[];
  initialTabs: any[];
  currentUser: any;
};

export default function DashboardPageClient({
  initialDebts,
  initialGroups,
  initialTabs,
  currentUser,
}: DashboardPageClientProps) {
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [groups] = useState<Group[]>(initialGroups);
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [error, setError] = useState("");
  const [chartView, setChartView] = useState<"owed" | "owing">("owed");
  const router = useRouter();

  const formatShortDate = (value: Date | string) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleUpdateStatus = async (debtId: number, newStatus: string) => {
    // Store the old status in case we need to revert
    const oldStatus = debts.find((d) => d.id === debtId)?.status;

    // Optimistically update the UI
    setDebts((prevDebts) =>
      prevDebts.map((debt) =>
        debt.id === debtId ? { ...debt, status: newStatus } : debt
      )
    );

    try {
      const result = await updateDebtStatus(debtId, newStatus);

      if (!result.success) {
        setError(result.error || "Failed to update status");
        // Revert to old status
        if (oldStatus) {
          setDebts((prevDebts) =>
            prevDebts.map((debt) =>
              debt.id === debtId ? { ...debt, status: oldStatus } : debt
            )
          );
        }
        return;
      }
    } catch (err) {
      setError("An error occurred while updating the status");
      // Revert to old status
      if (oldStatus) {
        setDebts((prevDebts) =>
          prevDebts.map((debt) =>
            debt.id === debtId ? { ...debt, status: oldStatus } : debt
          )
        );
      }
    }
  };

  const handleUpdateTabStatus = async (tabId: number, newStatus: string) => {
    const oldStatus = tabs.find((t) => t.id === tabId)?.status;

    // Optimistically update the UI
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
    } catch (err) {
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
  const activeTabs = tabs.filter((tab) => tab.status === "lending" || tab.status === "borrowing");
  const pendingDebts = debts.filter((debt) => debt.status === "pending");

  const calculateTotal = (debtList: Debt[]) => {
    return debtList.reduce((sum, debt) => sum + debt.amount, 0);
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
      const person =
        chartView === "owed" ? debt.borrower.email : debt.lender.email;
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
          display: false,
        },
        tooltip: {
          callbacks: {
            title: (context: any) => context[0]?.label || "",
            label: (context: any) => {
              const value = context.parsed;
              const total = context.dataset.data.reduce(
                (a: number, b: number) => a + b,
                0
              );
              const percentage = ((value / total) * 100).toFixed(1);
              return `$${value.toFixed(2)} (${percentage}%)`;
            },
            afterLabel: (context: any) => {
              const descriptions = chartDescriptions[context.dataIndex];
              if (!descriptions || descriptions.length === 0) return "";
              // Show up to 2 descriptions, truncated with bullets
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage your debts and loans.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Debts Summary with Chart */}
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setChartView("owed")}
            className={cn(
              "rounded-xl p-4 text-left transition-all",
              chartView === "owed"
                ? "bg-emerald-500/20 border-2 border-emerald-500/40 ring-2 ring-emerald-500/20"
                : "bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15"
            )}
          >
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              You are owed
            </p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              +${calculateTotal(lendingDebts).toFixed(2)}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setChartView("owing")}
            className={cn(
              "rounded-xl p-4 text-left transition-all",
              chartView === "owing"
                ? "bg-rose-500/20 border-2 border-rose-500/40 ring-2 ring-rose-500/20"
                : "bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/15"
            )}
          >
            <p className="text-sm text-rose-700 dark:text-rose-300">You owe</p>
            <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              -${calculateTotal(borrowingDebts).toFixed(2)}
            </p>
          </button>
        </div>

        {/* Doughnut Chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {chartView === "owed" ? "Who owes you" : "Who you owe"}
            </CardTitle>
            <CardDescription>Pending debts breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <Doughnut data={chartData} options={chartOptions} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Debts Leaderboard */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Debt leaderboard
            </h2>
            <p className="text-sm text-muted-foreground">
              {pendingDebts.length} pending • {debts.length} total
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push("/debts")}>
            View all
          </Button>
        </div>

        {pendingDebts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">No pending debts</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a debt from a group page
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {pendingDebts.map((debt) => {
              const isLending = debt.lender.id === currentUser?.id;
              const otherPerson = isLending ? debt.borrower : debt.lender;

              return (
                <div
                  key={debt.id}
                  onClick={() => router.push(`/debts/${debt.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{debt.borrower.email}</div>
                      {debt.description && <div className="mt-0.5 text-sm text-muted-foreground">{debt.description}</div>}
                      {debt.group && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Group: <span className="font-medium text-foreground">{debt.group.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold">${debt.amount.toFixed(2)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(debt.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        debt.status === 'pending' && 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
                        debt.status === 'paid' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                        debt.status === 'not_paying' && 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                      )}
                    >
                      {debt.status === 'not_paying' ? 'Not paying' : debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
                    </Badge>

                    <select
                      value={debt.status}
                      onChange={(e) => handleUpdateStatus(debt.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="not_paying">Not Paying</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>You are borrowing</CardTitle>
              <CardDescription>Money you owe</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tracking-tight text-foreground">
                ${calculateTotal(borrowingDebts).toFixed(2)}
              </div>
              <Badge className="mt-2" variant="secondary">
                {borrowingDebts.length} item{borrowingDebts.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {borrowingDebts.length === 0 ? (
              <div className="rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                No borrowing records.
              </div>
            ) : (
              borrowingDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="cursor-pointer rounded-lg border bg-background p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => router.push(`/debts/${debt.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{debt.lender.email}</div>
                      {debt.description && <div className="mt-0.5 text-sm text-muted-foreground">{debt.description}</div>}
                      {debt.group && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Group: <span className="font-medium text-foreground">{debt.group.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold">${debt.amount.toFixed(2)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(debt.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        debt.status === 'pending' && 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
                        debt.status === 'paid' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                        debt.status === 'not_paying' && 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                      )}
                    >
                      {debt.status === 'not_paying' ? 'Not paying' : debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
                    </Badge>

                    <select
                      value={debt.status}
                      onChange={(e) => handleUpdateStatus(debt.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="not_paying">Not Paying</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Your Tabs</h2>
            <p className="text-sm text-muted-foreground">
              Money you lend or borrow outside the platform
            </p>
          </div>
          <Button onClick={() => router.push("/tabs")}>View all</Button>
        </div>

        {activeTabs.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No tabs yet</CardTitle>
              <CardDescription>
                Track money you lend or borrow outside the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/tabs")}>Add a tab</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeTabs.map((tab) => (
              <Card key={tab.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{tab.personName}</CardTitle>
                    <Badge variant={tab.status === "lending" ? "default" : "secondary"}>
                      {tab.status === "lending" ? "Owes you" : "You owe"}
                    </Badge>
                  </div>
                  <CardDescription className="text-xl font-semibold text-foreground">
                    ${tab.amount.toFixed(2)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {tab.description}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(tab.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateTabStatus(tab.id, "paid")}
                  >
                    Mark Paid
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">
              Your Groups
            </h2>
            <p className="text-sm text-muted-foreground">
              Groups you're a member of
            </p>
          </div>
          <Button onClick={() => router.push("/groups")}>View all</Button>
        </div>

        {groups.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No groups yet</CardTitle>
              <CardDescription>
                You haven&apos;t joined any groups. Create one to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push("/groups")}>
                Go to groups
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => router.push(`/groups/${group.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                  <CardDescription>
                    {group._count.members}{" "}
                    {group._count.members === 1 ? "member" : "members"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Created {new Date(group.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
