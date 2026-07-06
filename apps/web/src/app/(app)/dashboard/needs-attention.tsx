"use client";

import Link from "next/link";
import { AlertTriangle, FileClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
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
 * Actionable replacement for the old dismissible banners: one card listing
 * transactions awaiting the user's approval and overdue payment alerts,
 * each row linking to where the user can act. Renders nothing when empty.
 */
export function NeedsAttention({
  pendingTransactions,
  alerts,
}: {
  pendingTransactions: PendingTransaction[];
  alerts: OverdueAlert[];
}) {
  const overdueAlerts = alerts.filter(
    (alert): alert is OverdueAlert & { debt: NonNullable<OverdueAlert["debt"]> } =>
      alert.debt !== null
  );

  if (pendingTransactions.length === 0 && overdueAlerts.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs attention</CardTitle>
        <CardDescription>
          Requests waiting on your approval and overdue payments
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ItemGroup className="gap-2">
          {pendingTransactions.map((transaction) => {
            const requesterName =
              transaction.requester.name || transaction.requester.email;
            return (
              <Item
                key={`transaction-${transaction.id}`}
                variant="outline"
                size="sm"
              >
                <ItemMedia variant="icon">
                  <FileClock />
                </ItemMedia>
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
                    <Link href="/debts/requests">Review</Link>
                  </Button>
                </ItemActions>
              </Item>
            );
          })}

          {overdueAlerts.map((alert) => {
            const lenderName = alert.lender.name || alert.lender.email;
            return (
              <Item key={`alert-${alert.id}`} variant="outline" size="sm">
                <ItemMedia variant="icon">
                  <AlertTriangle />
                </ItemMedia>
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
    </Card>
  );
}
