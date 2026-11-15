"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Bell, AlertTriangle, FileEdit, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

type NotificationsDropdownProps = {
  alerts: Alert[];
  pendingTransactions: DebtTransaction[];
  friendRequests: number;
  groupInvites: number;
};

export function NotificationsDropdown({
  alerts,
  pendingTransactions,
  friendRequests,
  groupInvites,
}: NotificationsDropdownProps) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  const overduePayments = alerts;
  const totalNotifications =
    overduePayments.length +
    pendingTransactions.length +
    friendRequests +
    groupInvites;

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  const getTransactionLabel = (transaction: DebtTransaction) => {
    if (transaction.type === "drop") return "Drop request";
    if (transaction.type === "confirm_paid") return "Payment confirmation";
    if (transaction.type === "modify") return "Modification request";
    return "Transaction";
  };

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) router.refresh();
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8"
          aria-label={`Notifications${totalNotifications ? ` (${totalNotifications} need attention)` : ""}`}
        >
          <Bell className="size-5" />
          {totalNotifications > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] tabular-nums"
              aria-hidden="true"
            >
              {totalNotifications > 9 ? "9+" : totalNotifications}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="px-3 py-2.5 text-sm font-semibold">
          Needs your attention
        </div>
        <DropdownMenuSeparator className="my-0" />

        {totalNotifications === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            You&apos;re all caught up
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            {overduePayments.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Overdue payments
                </DropdownMenuLabel>
                {overduePayments.map((alert) => (
                  <DropdownMenuItem
                    key={alert.id}
                    className="flex items-start gap-3 px-3 py-2.5"
                    asChild
                  >
                    <Link href={`/debts/${alert.debt!.id}`}>
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="text-sm font-medium">
                          {alert.message || "Payment overdue"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {alert.debt?.description || "No description"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {alert.deadline
                            ? `Due ${formatDate(alert.deadline)}`
                            : "No deadline"}{" "}
                          · From {alert.lender.name || alert.lender.email}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        ${alert.debt?.amount.toFixed(2)}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}

            {overduePayments.length > 0 && pendingTransactions.length > 0 && (
              <DropdownMenuSeparator />
            )}

            {pendingTransactions.length > 0 && (
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Pending approvals
                </DropdownMenuLabel>
                {pendingTransactions.map((transaction) => (
                  <DropdownMenuItem
                    key={transaction.id}
                    className="flex items-start gap-3 px-3 py-2.5"
                    asChild
                  >
                    <Link
                      href={`/debts/${transaction.debt.id}/requests/${transaction.id}`}
                    >
                      <FileEdit className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <p className="text-sm font-medium">
                          {getTransactionLabel(transaction)}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {transaction.debt.description || "No description"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          From{" "}
                          {transaction.requester.name ||
                            transaction.requester.email}{" "}
                          · {formatDate(transaction.createdAt)}
                        </p>
                        {transaction.reason && (
                          <p className="truncate text-xs italic text-muted-foreground">
                            &quot;{transaction.reason}&quot;
                          </p>
                        )}
                      </div>
                      {transaction.type === "modify" &&
                        transaction.proposedAmount !== null && (
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            ${transaction.proposedAmount.toFixed(2)}
                          </span>
                        )}
                    </Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            )}
            {(friendRequests > 0 || groupInvites > 0) && (
              <DropdownMenuGroup>
                {(overduePayments.length > 0 ||
                  pendingTransactions.length > 0) && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Invitations
                </DropdownMenuLabel>
                {friendRequests > 0 && (
                  <DropdownMenuItem asChild>
                    <Link href="/friends?tab=requests">
                      <UserPlus />
                      {friendRequests} friend{" "}
                      {friendRequests === 1 ? "request" : "requests"}
                    </Link>
                  </DropdownMenuItem>
                )}
                {groupInvites > 0 && (
                  <DropdownMenuItem asChild>
                    <Link href="/invites">
                      <Users />
                      {groupInvites} group{" "}
                      {groupInvites === 1 ? "invite" : "invites"}
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
