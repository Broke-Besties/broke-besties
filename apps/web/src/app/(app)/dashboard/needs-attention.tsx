"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardFooter,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import type { OverdueAlert, PendingTransaction } from "./types";

function getTypeLabel(type: string): string {
  switch (type) {
    case "confirm_paid":
      return "Payment confirmation";
    case "modify":
      return "Modification";
    case "drop":
      return "Deletion";
    default:
      return type;
  }
}

/**
 * A bounded preview of approval requests and overdue debts, with room for both.
 */
export function NeedsAttention({
  asOf,
  pendingTransactions,
  alerts,
}: {
  asOf: number;
  pendingTransactions: PendingTransaction[];
  alerts: OverdueAlert[];
}) {
  const overdueAlerts = alerts.filter(
    (
      alert,
    ): alert is OverdueAlert & { debt: NonNullable<OverdueAlert["debt"]> } =>
      alert.isActive &&
      alert.debt !== null &&
      alert.debt.status === "pending" &&
      alert.deadline !== null &&
      new Date(alert.deadline).getTime() < asOf,
  );
  const shownAlerts = overdueAlerts.slice(
    0,
    pendingTransactions.length ? 2 : 4,
  );
  const shownTransactions = pendingTransactions.slice(
    0,
    4 - shownAlerts.length,
  );
  const total = pendingTransactions.length + overdueAlerts.length;
  const shown = shownTransactions.length + shownAlerts.length;

  if (pendingTransactions.length === 0 && overdueAlerts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Needs attention <Badge variant="secondary">{total}</Badge>
        </CardTitle>
        <CardDescription>
          Requests waiting on your approval and overdue payments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="gap-2">
          {shownTransactions.map((transaction) => {
            const requesterName =
              transaction.requester.name || transaction.requester.email;
            return (
              <Item
                key={`transaction-${transaction.id}`}
                variant="outline"
                size="sm"
              >
                <ItemContent>
                  <ItemTitle className="tabular-nums">
                    {getTypeLabel(transaction.type)} · $
                    {transaction.debt.amount.toFixed(2)}
                    {transaction.proposedAmount !== null && (
                      <span className="font-normal text-muted-foreground">
                        → ${transaction.proposedAmount.toFixed(2)}
                      </span>
                    )}
                  </ItemTitle>
                  <ItemDescription>
                    Requested by {requesterName}
                    {transaction.reason ? ` · ${transaction.reason}` : ""}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/debts/${transaction.debt.id}/requests/${transaction.id}`}
                    >
                      Review
                    </Link>
                  </Button>
                </ItemActions>
              </Item>
            );
          })}

          {shownAlerts.map((alert) => {
            const lenderName = alert.lender.name || alert.lender.email;
            return (
              <Item key={`alert-${alert.id}`} variant="outline" size="sm">
                <ItemContent>
                  <ItemTitle className="tabular-nums">
                    Overdue payment · ${alert.debt.amount.toFixed(2)}
                  </ItemTitle>
                  <ItemDescription>
                    Owed to {lenderName}
                    {alert.message ? ` · ${alert.message}` : ""}
                    {alert.deadline
                      ? ` · Due ${new Date(alert.deadline).toLocaleDateString()}`
                      : ""}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/debts/${alert.debt.id}`}>View debt</Link>
                  </Button>
                </ItemActions>
              </Item>
            );
          })}
        </ItemGroup>
      </CardContent>
      <CardFooter className="flex flex-wrap justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing {shown} of {total} items
        </p>
        <div className="flex flex-wrap gap-2">
          {pendingTransactions.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/debts/requests">
                All requests ({pendingTransactions.length})
              </Link>
            </Button>
          )}
          {overdueAlerts.length > 0 && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/debts">All debts</Link>
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
