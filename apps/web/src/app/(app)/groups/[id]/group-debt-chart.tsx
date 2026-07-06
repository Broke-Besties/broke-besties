"use client";

import { useState, useMemo } from "react";
import { Pie, PieChart } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { MultiSelect } from "@/components/ui/multi-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { chartColor } from "@/lib/chart-colors";
import type { Debt, Member } from "./types";

type StatusFilter = "all" | "pending" | "paid";
type ViewFilter = "all" | "owe" | "owed";

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

  // Chart data (recharts)
  const { chartData, chartConfig } = useMemo(() => {
    const data = balances.map((b, i) => ({
      key: `bal-${i}`,
      label: `${b.fromName} → ${b.toName}`,
      amount: b.amount,
      fill: chartColor(i),
    }));
    const config: ChartConfig = { amount: { label: "Amount" } };
    balances.forEach((b, i) => {
      config[`bal-${i}`] = {
        label: `${b.fromName} → ${b.toName}`,
        color: chartColor(i),
      };
    });
    return { chartData: data, chartConfig: config };
  }, [balances]);

  const totalOwed = balances.reduce((sum, b) => sum + b.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Debt Overview</CardTitle>
        <CardDescription>Who owes who in this group</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* View + status filters */}
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          {currentUserId && (
            <div className="space-y-2">
              <span className="text-sm font-medium">View</span>
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                value={viewFilter}
                onValueChange={(value) =>
                  value && setViewFilter(value as ViewFilter)
                }
              >
                <ToggleGroupItem value="all">All debts</ToggleGroupItem>
                <ToggleGroupItem value="owe">You owe</ToggleGroupItem>
                <ToggleGroupItem value="owed">Owed to you</ToggleGroupItem>
              </ToggleGroup>
            </div>
          )}

          <div className="space-y-2">
            <span className="text-sm font-medium">Status</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={statusFilter}
              onValueChange={(value) =>
                value && setStatusFilter(value as StatusFilter)
              }
            >
              <ToggleGroupItem value="all">
                All ({statusCounts.all})
              </ToggleGroupItem>
              <ToggleGroupItem value="pending">
                Pending ({statusCounts.pending})
              </ToggleGroupItem>
              <ToggleGroupItem value="paid">
                Paid ({statusCounts.paid})
              </ToggleGroupItem>
            </ToggleGroup>
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
        {balances.length > 0 ? (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[240px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    nameKey="key"
                    formatter={(value, name, item) => (
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {item.payload.label}
                        </span>
                        <span className="font-mono tabular-nums">
                          ${Number(value).toFixed(2)}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="amount"
                nameKey="key"
                innerRadius={60}
                strokeWidth={5}
              />
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No outstanding debts to chart.
          </div>
        )}

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
