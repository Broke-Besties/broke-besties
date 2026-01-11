"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

type Debt = {
  id: number;
  amount: number;
  description: string | null;
  status: string;
  createdAt: Date | string;
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

      {/* Debts Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            You are owed
          </p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            +${calculateTotal(lendingDebts).toFixed(2)}
          </p>
        </div>
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4">
          <p className="text-sm text-rose-700 dark:text-rose-300">You owe</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            -${calculateTotal(borrowingDebts).toFixed(2)}
          </p>
        </div>
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
                  className={cn(
                    "group flex items-center justify-between gap-4 rounded-xl border bg-card/50 p-4 cursor-pointer transition-colors hover:bg-accent/30"
                  )}
                >
                  {/* Left: Person & Details */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                        isLending
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                      )}
                    >
                      {otherPerson.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {otherPerson.email}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {debt.description ||
                          (debt.group ? debt.group.name : "No description")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {debt.group?.name ? `${debt.group.name} • ` : ""}
                        Added {formatShortDate(debt.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Amount & Status */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p
                        className={cn(
                          "text-lg font-bold",
                          isLending
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-rose-600 dark:text-rose-400"
                        )}
                      >
                        {isLending ? "+" : "-"}${debt.amount.toFixed(2)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStatus(
                          debt.id,
                          debt.status === "pending" ? "paid" : "pending"
                        );
                      }}
                      className={cn(
                        "h-8 rounded-full border px-3 text-xs font-medium shadow-sm transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        debt.status === "pending"
                          ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/15 dark:text-yellow-300"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                      )}
                    >
                      {debt.status === "pending" ? "Pending" : "Paid"}
                    </button>
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
                    Added {new Date(tab.createdAt).toLocaleDateString()}
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
                  Created {new Date(group.createdAt).toLocaleDateString()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
