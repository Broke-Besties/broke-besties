import { History } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { StatusBadge } from "@/components/status-badge";
import {
  displayName,
  initials,
  transactionTypeLabel,
  type DebtTransactionRecord,
} from "./types";

export function ActivityCard({
  transactions,
}: {
  transactions: DebtTransactionRecord[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          Activity
        </CardTitle>
        <CardDescription>All change requests for this debt</CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <Empty className="py-8">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History />
              </EmptyMedia>
              <EmptyTitle>No activity yet</EmptyTitle>
              <EmptyDescription>
                Change requests and payment confirmations will appear here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-2">
            {transactions.map((transaction) => (
              <Item key={transaction.id} variant="muted">
                <ItemMedia>
                  <Avatar>
                    <AvatarFallback>
                      {initials(displayName(transaction.requester))}
                    </AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {transactionTypeLabel(transaction.type)}
                    <StatusBadge status={transaction.status} />
                  </ItemTitle>
                  <ItemDescription>
                    {displayName(transaction.requester)}
                    {transaction.type === "modify" &&
                      transaction.proposedAmount !== null &&
                      ` · Proposed $${transaction.proposedAmount.toFixed(2)}`}
                    {transaction.reason && ` · ${transaction.reason}`}
                  </ItemDescription>
                </ItemContent>
                <div className="shrink-0 self-start text-right text-xs text-muted-foreground">
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </div>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}
