"use client";

import { useState, useMemo } from "react";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { Doughnut } from "react-chartjs-2";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "pending" | "paid";
type ViewFilter = "all" | "owe" | "owed";

ChartJS.register(ArcElement, Tooltip, Legend);

type Member = {
  id: number;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  lender: {
    id: string;
    name: string;
    email: string;
  };
  borrower: {
    id: string;
    name: string;
    email: string;
  };
};

type GroupDebtChartProps = {
  members: Member[];
  debts: Debt[];
  currentUserId?: string;
};

type BalanceEntry = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
};

// Blue/slate color palette matching the app's muted theme
const COLORS = [
  "hsl(210 45% 70%)", // light blue
  "hsl(210 35% 60%)", // medium blue
  "hsl(215 30% 50%)", // slate blue
  "hsl(220 25% 40%)", // dark slate
  "hsl(215 20% 35%)", // darker slate
  "hsl(205 40% 65%)", // soft sky blue
  "hsl(200 30% 55%)", // muted cyan-blue
  "hsl(225 20% 45%)", // blue-gray
];

const BORDER_COLORS = [
  "hsl(210 45% 60%)",
  "hsl(210 35% 50%)",
  "hsl(215 30% 40%)",
  "hsl(220 25% 30%)",
  "hsl(215 20% 25%)",
  "hsl(205 40% 55%)",
  "hsl(200 30% 45%)",
  "hsl(225 20% 35%)",
];

export function GroupDebtChart({
  members,
  debts,
  currentUserId,
}: GroupDebtChartProps) {
  // Status filter (pending/paid/all)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  // View filter (all debts / what I owe / what I'm owed)
  const [viewFilter, setViewFilter] = useState<ViewFilter>("all");
  // Selected lenders and borrowers for advanced filtering
  const [selectedLenders, setSelectedLenders] = useState<string[]>(() =>
    members.map((m) => m.user.id)
  );
  const [selectedBorrowers, setSelectedBorrowers] = useState<string[]>(() =>
    members.map((m) => m.user.id)
  );

  // Member options for dropdowns
  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        value: m.user.id,
        label:
          m.user.id === currentUserId
            ? `${m.user.name || m.user.email} (you)`
            : m.user.name || m.user.email,
      })),
    [members, currentUserId]
  );

  // Status counts for filter badges
  const statusCounts = useMemo(
    () => ({
      all: debts.length,
      pending: debts.filter((d) => d.status === "pending").length,
      paid: debts.filter((d) => d.status === "paid").length,
    }),
    [debts]
  );

  // Calculate amounts for quick view buttons
  const viewAmounts = useMemo(() => {
    if (!currentUserId) return { owe: 0, owed: 0 };

    const pendingDebts = debts.filter((d) => d.status === "pending");
    const owe = pendingDebts
      .filter((d) => d.borrower.id === currentUserId)
      .reduce((sum, d) => sum + d.amount, 0);
    const owed = pendingDebts
      .filter((d) => d.lender.id === currentUserId)
      .reduce((sum, d) => sum + d.amount, 0);

    return { owe, owed };
  }, [debts, currentUserId]);

  // Calculate net balances based on all filters
  const balances = useMemo(() => {
    // Apply status filter
    let relevantDebts = debts.filter(
      (d) => statusFilter === "all" || d.status === statusFilter
    );

    // Apply view filter (quick buttons)
    if (viewFilter === "owe" && currentUserId) {
      relevantDebts = relevantDebts.filter(
        (d) => d.borrower.id === currentUserId
      );
    } else if (viewFilter === "owed" && currentUserId) {
      relevantDebts = relevantDebts.filter(
        (d) => d.lender.id === currentUserId
      );
    }

    // Apply lender/borrower dropdown filters
    relevantDebts = relevantDebts.filter(
      (d) =>
        selectedLenders.includes(d.lender.id) &&
        selectedBorrowers.includes(d.borrower.id)
    );

    // Build a map of net balances: key = "fromId->toId", value = amount owed
    const netMap = new Map<string, number>();
    const userNames = new Map<string, string>();

    for (const debt of relevantDebts) {
      userNames.set(debt.lender.id, debt.lender.name || debt.lender.email);
      userNames.set(
        debt.borrower.id,
        debt.borrower.name || debt.borrower.email
      );

      // borrower owes lender
      const key1 = `${debt.borrower.id}->${debt.lender.id}`;
      const key2 = `${debt.lender.id}->${debt.borrower.id}`;

      if (netMap.has(key2)) {
        // Reduce the opposite direction
        const current = netMap.get(key2)!;
        const newAmount = current - debt.amount;
        if (newAmount > 0) {
          netMap.set(key2, newAmount);
        } else if (newAmount < 0) {
          netMap.delete(key2);
          netMap.set(key1, -newAmount);
        } else {
          netMap.delete(key2);
        }
      } else {
        netMap.set(key1, (netMap.get(key1) || 0) + debt.amount);
      }
    }

    // Convert to array of balance entries
    const entries: BalanceEntry[] = [];
    for (const [key, amount] of netMap) {
      if (amount > 0) {
        const [fromId, toId] = key.split("->");
        entries.push({
          fromId,
          fromName: userNames.get(fromId) || fromId,
          toId,
          toName: userNames.get(toId) || toId,
          amount,
        });
      }
    }

    // Sort by amount descending
    return entries.sort((a, b) => b.amount - a.amount);
  }, [debts, statusFilter, viewFilter, currentUserId, selectedLenders, selectedBorrowers]);

  // Chart data
  const chartData = useMemo(() => {
    if (balances.length === 0) {
      return {
        labels: ["No outstanding debts"],
        datasets: [
          {
            data: [1],
            backgroundColor: ["rgba(156, 163, 175, 0.3)"],
            borderColor: ["rgba(156, 163, 175, 0.5)"],
            borderWidth: 1,
          },
        ],
      };
    }

    return {
      labels: balances.map((b) => `${b.fromName} → ${b.toName}`),
      datasets: [
        {
          data: balances.map((b) => b.amount),
          backgroundColor: balances.map((_, i) => COLORS[i % COLORS.length]),
          borderColor: balances.map(
            (_, i) => BORDER_COLORS[i % BORDER_COLORS.length]
          ),
          borderWidth: 2,
        },
      ],
    };
  }, [balances]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom" as const,
        labels: {
          padding: 16,
          usePointStyle: true,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            return ` $${value.toFixed(2)}`;
          },
        },
      },
    },
    cutout: "60%",
  };

  const totalOwed = balances.reduce((sum, b) => sum + b.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Debt Overview</CardTitle>
        <CardDescription>Who owes who in this group</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick view buttons */}
        {currentUserId && (
          <div className="space-y-2">
            <span className="text-sm font-medium">Quick view</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setViewFilter("all")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  viewFilter === "all"
                    ? "bg-primary/90 text-primary-foreground"
                    : "bg-muted hover:bg-muted/70"
                )}
              >
                All debts
              </button>
              <button
                onClick={() => setViewFilter("owe")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  viewFilter === "owe"
                    ? "bg-rose-200/60 text-rose-900 dark:bg-rose-900/40 dark:text-rose-200"
                    : "bg-rose-100/50 text-rose-800 hover:bg-rose-200/50 dark:bg-rose-900/20 dark:text-rose-300 dark:hover:bg-rose-900/30"
                )}
              >
                What I owe (${viewAmounts.owe.toFixed(2)})
              </button>
              <button
                onClick={() => setViewFilter("owed")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  viewFilter === "owed"
                    ? "bg-emerald-200/60 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : "bg-emerald-100/50 text-emerald-800 hover:bg-emerald-200/50 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
                )}
              >
                What I&apos;m owed (${viewAmounts.owed.toFixed(2)})
              </button>
            </div>
          </div>
        )}

        {/* Status filter */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Status</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                statusFilter === "all"
                  ? "bg-primary/90 text-primary-foreground"
                  : "bg-muted hover:bg-muted/70"
              )}
            >
              All ({statusCounts.all})
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                statusFilter === "pending"
                  ? "bg-amber-200/60 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                  : "bg-amber-100/50 text-amber-800 hover:bg-amber-200/50 dark:bg-amber-900/20 dark:text-amber-300 dark:hover:bg-amber-900/30"
              )}
            >
              Pending ({statusCounts.pending})
            </button>
            <button
              onClick={() => setStatusFilter("paid")}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                statusFilter === "paid"
                  ? "bg-emerald-200/60 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "bg-emerald-100/50 text-emerald-800 hover:bg-emerald-200/50 dark:bg-emerald-900/20 dark:text-emerald-300 dark:hover:bg-emerald-900/30"
              )}
            >
              Paid ({statusCounts.paid})
            </button>
          </div>
        </div>

        {/* Lender/Borrower dropdowns */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <span className="text-sm font-medium">Lenders</span>
            <MultiSelect
              options={memberOptions}
              selected={selectedLenders}
              onChange={setSelectedLenders}
              placeholder="Select lenders..."
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Borrowers</span>
            <MultiSelect
              options={memberOptions}
              selected={selectedBorrowers}
              onChange={setSelectedBorrowers}
              placeholder="Select borrowers..."
            />
          </div>
        </div>

        {/* Chart */}
        <div className="h-64">
          <Doughnut data={chartData} options={chartOptions} />
        </div>

        {/* Summary */}
        {balances.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {statusFilter === "all"
                  ? "Total"
                  : statusFilter === "pending"
                  ? "Total outstanding"
                  : "Total paid"}
              </span>
              <span className="font-semibold">${totalOwed.toFixed(2)}</span>
            </div>
            <div className="space-y-1">
              {balances.map((balance, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-muted-foreground">
                    {balance.fromName} owes {balance.toName}
                  </span>
                  <span className="font-medium">
                    ${balance.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {balances.length === 0 && (selectedLenders.length > 0 || selectedBorrowers.length > 0) && (
          <div className="border-t pt-4 text-center text-sm text-muted-foreground">
            No {statusFilter === "all" ? "" : statusFilter + " "}debts match
            your filters.
          </div>
        )}

        {selectedLenders.length === 0 && selectedBorrowers.length === 0 && (
          <div className="border-t pt-4 text-center text-sm text-muted-foreground">
            Select lenders or borrowers to see debt relationships.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
