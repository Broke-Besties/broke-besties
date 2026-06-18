"use client";

import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  currentUserId: string;
};

export function NotificationsDropdown({
  alerts,
  pendingTransactions,
}: NotificationsDropdownProps) {
  const router = useRouter();

  const overduePayments = alerts.filter((a) => a.debt !== null);
  const totalNotifications = overduePayments.length + pendingTransactions.length;

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {totalNotifications > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white tabular-nums">
              {totalNotifications > 9 ? "9+" : totalNotifications}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="px-3 py-2.5 text-sm font-semibold">Notifications</div>
        <DropdownMenuSeparator className="my-0" />

        {totalNotifications === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            {overduePayments.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Overdue payments
                </DropdownMenuLabel>
                {overduePayments.map((alert) => (
                  <DropdownMenuItem
                    key={alert.id}
                    className="flex items-start gap-3 px-3 py-2.5"
                    onSelect={() => {
                      if (alert.debt) router.push(`/debts/${alert.debt.id}`);
                    }}
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-0.5">
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
                  </DropdownMenuItem>
                ))}
              </>
            )}

            {overduePayments.length > 0 && pendingTransactions.length > 0 && (
              <DropdownMenuSeparator />
            )}

            {pendingTransactions.length > 0 && (
              <>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Pending approvals
                </DropdownMenuLabel>
                {pendingTransactions.map((transaction) => (
                  <DropdownMenuItem
                    key={transaction.id}
                    className="flex items-start gap-3 px-3 py-2.5"
                    onSelect={() => router.push(`/debts/${transaction.debt.id}`)}
                  >
                    <FileEdit className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1 space-y-0.5">
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
                      transaction.proposedAmount && (
                        <span className="shrink-0 text-sm font-semibold tabular-nums">
                          ${transaction.proposedAmount.toFixed(2)}
                        </span>
                      )}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
