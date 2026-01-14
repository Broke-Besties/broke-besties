"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, AlertTriangle, FileEdit, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  currentUserId,
}: NotificationsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
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
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {totalNotifications > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
            {totalNotifications > 9 ? "9+" : totalNotifications}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="font-semibold">Notifications</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
              {totalNotifications === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No notifications
                </div>
              ) : (
                <>
                  {/* Overdue Payments */}
                  {overduePayments.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                        OVERDUE PAYMENTS
                      </div>
                      {overduePayments.map((alert) => (
                        <button
                          key={alert.id}
                          onClick={() => {
                            if (alert.debt) {
                              router.push(`/debts/${alert.debt.id}`);
                              setIsOpen(false);
                            }
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm font-medium">
                                {alert.message || "Payment overdue"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {alert.debt?.description || "No description"}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>
                                  {alert.deadline
                                    ? `Due ${formatDate(alert.deadline)}`
                                    : "No deadline"}
                                </span>
                                <span>•</span>
                                <span>
                                  From {alert.lender.name || alert.lender.email}
                                </span>
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-orange-600 shrink-0">
                              ${alert.debt?.amount.toFixed(2)}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  {overduePayments.length > 0 && pendingTransactions.length > 0 && (
                    <div className="border-t" />
                  )}

                  {/* Pending Transactions */}
                  {pendingTransactions.length > 0 && (
                    <div className="py-2">
                      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                        PENDING APPROVALS
                      </div>
                      {pendingTransactions.map((transaction) => (
                        <button
                          key={transaction.id}
                          onClick={() => {
                            router.push(`/debts/${transaction.debt.id}`);
                            setIsOpen(false);
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-accent/50 transition-colors border-b last:border-b-0"
                        >
                          <div className="flex items-start gap-3">
                            <FileEdit className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm font-medium">
                                {getTransactionLabel(transaction)}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {transaction.debt.description || "No description"}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>
                                  From{" "}
                                  {transaction.requester.name ||
                                    transaction.requester.email}
                                </span>
                                <span>•</span>
                                <span>{formatDate(transaction.createdAt)}</span>
                              </div>
                              {transaction.reason && (
                                <p className="text-xs text-muted-foreground italic truncate">
                                  &quot;{transaction.reason}&quot;
                                </p>
                              )}
                            </div>
                            {transaction.type === "modify" &&
                              transaction.proposedAmount && (
                                <p className="text-sm font-semibold text-emerald-600 shrink-0">
                                  ${transaction.proposedAmount.toFixed(2)}
                                </p>
                              )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

