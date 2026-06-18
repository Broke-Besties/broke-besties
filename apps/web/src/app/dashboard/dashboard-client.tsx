"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Label, Pie, PieChart } from "recharts";
import NumberFlow from "@number-flow/react";
import {
  TrendingUp,
  TrendingDown,
  Repeat,
  CalendarClock,
  Plus,
  AlertTriangle,
  FileClock,
  Users,
  Receipt,
  Inbox,
  X,
} from "lucide-react";

import {
  Alert as AlertBanner,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { chartColor } from "@/lib/chart-colors";
import { updateTabStatus } from "./actions";

type Debt = {
  id: number
  amount: number
  description: string | null
  status: string
  createdAt: Date | string
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

function initials(value: string): string {
  const parts = value.split(/[\s._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || value.slice(0, 2)).toUpperCase();
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
  const [chartView, setChartView] = useState<"owed" | "owing">("owed");
  const router = useRouter();

  const handleUpdateTabStatus = async (tabId: number, newStatus: string) => {
    const oldStatus = tabs.find((t) => t.id === tabId)?.status;

    setTabs((prevTabs) =>
      prevTabs.map((tab) =>
        tab.id === tabId ? { ...tab, status: newStatus } : tab
      )
    );

    const revert = () => {
      if (oldStatus) {
        setTabs((prevTabs) =>
          prevTabs.map((tab) =>
            tab.id === tabId ? { ...tab, status: oldStatus } : tab
          )
        );
      }
    };

    try {
      const result = await updateTabStatus(tabId, newStatus);
      if (!result.success) {
        toast.error(result.error || "Failed to update tab status");
        revert();
      }
    } catch {
      toast.error("An error occurred while updating the tab status");
      revert();
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
    return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  }, [recurringPayments]);

  const formatDate = (date: Date) =>
    date.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  // Chart data based on selected view
  const { chartData, chartConfig, chartTotal } = useMemo(() => {
    const relevantDebts =
      chartView === "owed"
        ? lendingDebts.filter((d) => d.status === "pending")
        : borrowingDebts.filter((d) => d.status === "pending");

    const personData = new Map<string, number>();
    for (const debt of relevantDebts) {
      const personObj = chartView === "owed" ? debt.borrower : debt.lender;
      const person = personObj.name || personObj.email;
      personData.set(person, (personData.get(person) ?? 0) + debt.amount);
    }

    const entries = Array.from(personData.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    const data = entries.map(([person, amount], i) => ({
      key: `person-${i}`,
      person,
      amount,
      fill: chartColor(i),
    }));

    const config: ChartConfig = { amount: { label: "Amount" } };
    entries.forEach(([person], i) => {
      config[`person-${i}`] = { label: person, color: chartColor(i) };
    });

    const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

    return { chartData: data, chartConfig: config, chartTotal: total };
  }, [chartView, lendingDebts, borrowingDebts]);

  const overduePayments = alerts.filter((a) => a.debt !== null);

  return (
    <div className="space-y-6">
      {/* Notification banners */}
      {showOverdueBanner && overduePayments.length > 0 && (
        <AlertBanner>
          <AlertTriangle />
          <AlertTitle>
            You have {overduePayments.length} overdue payment
            {overduePayments.length > 1 ? "s" : ""}
          </AlertTitle>
          <AlertDescription>
            Review them on your debts to avoid late reminders.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-7"
            onClick={() => setShowOverdueBanner(false)}
            aria-label="Dismiss"
          >
            <X />
          </Button>
        </AlertBanner>
      )}

      {showPendingBanner && pendingTransactions.length > 0 && (
        <AlertBanner>
          <FileClock />
          <AlertTitle>
            {pendingTransactions.length} transaction
            {pendingTransactions.length > 1 ? "s" : ""} waiting for your approval
          </AlertTitle>
          <AlertDescription>
            Approve or decline them from the related debt.
          </AlertDescription>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-7"
            onClick={() => setShowPendingBanner(false)}
            aria-label="Dismiss"
          >
            <X />
          </Button>
        </AlertBanner>
      )}

      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Image
            src="/mascot/mascot.png"
            alt="Mascot"
            width={64}
            height={64}
            className="size-14 shrink-0 sm:size-16"
          />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Welcome back, {userName}
            </h1>
            <p className="text-sm text-muted-foreground">
              An overview of your debts and recurring payments
            </p>
          </div>
        </div>
        <Button onClick={() => router.push("/debts")} className="sm:w-auto">
          <Plus />
          Add debt
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card
          role="button"
          tabIndex={0}
          onClick={() => setChartView("owed")}
          onKeyDown={(e) => e.key === "Enter" && setChartView("owed")}
          className={cn(
            "cursor-pointer transition-colors hover:bg-accent/50",
            chartView === "owed" && "border-ring ring-1 ring-ring"
          )}
        >
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              You are owed
            </CardTitle>
            <TrendingUp className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            <NumberFlow
              value={calculateTotal(lendingDebts)}
              format={{ style: "currency", currency: "USD" }}
            />
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => setChartView("owing")}
          onKeyDown={(e) => e.key === "Enter" && setChartView("owing")}
          className={cn(
            "cursor-pointer transition-colors hover:bg-accent/50",
            chartView === "owing" && "border-ring ring-1 ring-ring"
          )}
        >
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              You owe
            </CardTitle>
            <TrendingDown className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            <NumberFlow
              value={calculateTotal(borrowingDebts)}
              format={{ style: "currency", currency: "USD" }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active recurring
            </CardTitle>
            <Repeat className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">
            <NumberFlow value={recurringPayments.length} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Next renewal
            </CardTitle>
            <CalendarClock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {nextRenewalDate ? formatDate(nextRenewalDate) : "None"}
          </CardContent>
        </Card>
      </div>

      {/* Chart + upcoming payments */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>
              {chartView === "owed" ? "Who owes you" : "Who you owe"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1">
            {chartData.length === 0 ? (
              <Empty className="h-full">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Inbox />
                  </EmptyMedia>
                  <EmptyTitle>
                    {chartView === "owed" ? "No one owes you" : "You owe no one"}
                  </EmptyTitle>
                  <EmptyDescription>
                    Pending debts will appear here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ChartContainer
                config={chartConfig}
                className="mx-auto aspect-square max-h-[220px]"
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
                              {item.payload.person}
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
                  >
                    <Label
                      content={({ viewBox }) => {
                        if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                          return (
                            <text
                              x={viewBox.cx}
                              y={viewBox.cy}
                              textAnchor="middle"
                              dominantBaseline="middle"
                            >
                              <tspan
                                x={viewBox.cx}
                                y={viewBox.cy}
                                className="fill-foreground text-2xl font-bold tabular-nums"
                              >
                                ${chartTotal.toFixed(0)}
                              </tspan>
                              <tspan
                                x={viewBox.cx}
                                y={(viewBox.cy || 0) + 22}
                                className="fill-muted-foreground text-xs"
                              >
                                {chartView === "owed" ? "owed to you" : "you owe"}
                              </tspan>
                            </text>
                          );
                        }
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming payments</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/recurring-payments")}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {upcomingPayments.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarClock />
                  </EmptyMedia>
                  <EmptyTitle>Nothing due soon</EmptyTitle>
                  <EmptyDescription>
                    No payments due in the next 7 days.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {upcomingPayments.map((payment) => (
                  <Item key={payment.id} variant="outline" size="sm">
                    <ItemContent>
                      <ItemTitle>
                        {payment.description || "Recurring payment"}
                      </ItemTitle>
                      <ItemDescription>
                        {payment.daysUntil === 0
                          ? "Due today"
                          : payment.daysUntil === 1
                          ? "Due tomorrow"
                          : `Due in ${payment.daysUntil} days`}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="font-semibold tabular-nums">
                      ${payment.amount.toFixed(2)}
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Groups + tabs */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your groups</CardTitle>
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
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>No groups yet</EmptyTitle>
                  <EmptyDescription>
                    Create a group to split shared costs.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {groups.slice(0, 3).map((group) => (
                  <Item key={group.id} variant="outline" size="sm" asChild>
                    <button
                      type="button"
                      onClick={() => router.push(`/groups/${group.id}`)}
                      className="w-full text-left"
                    >
                      <ItemMedia>
                        <Avatar className="size-9">
                          <AvatarFallback>{initials(group.name)}</AvatarFallback>
                        </Avatar>
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{group.name}</ItemTitle>
                        <ItemDescription>
                          {group._count.members}{" "}
                          {group._count.members === 1 ? "member" : "members"}
                        </ItemDescription>
                      </ItemContent>
                    </button>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your tabs</CardTitle>
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
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Receipt />
                  </EmptyMedia>
                  <EmptyTitle>No active tabs</EmptyTitle>
                  <EmptyDescription>
                    Quick IOUs you track yourself show up here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {activeTabs.slice(0, 3).map((tab) => (
                  <Item key={tab.id} variant="outline" size="sm">
                    <ItemMedia>
                      <Avatar className="size-9">
                        <AvatarFallback>{initials(tab.personName)}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{tab.personName}</ItemTitle>
                      <ItemDescription>
                        <Badge variant="secondary">
                          {tab.status === "lending" ? "Owes you" : "You owe"}
                        </Badge>
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <span className="font-semibold tabular-nums">
                        ${tab.amount.toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateTabStatus(tab.id, "paid")}
                      >
                        Paid
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
