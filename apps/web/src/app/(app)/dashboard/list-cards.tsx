"use client";

import Link from "next/link";
import { CalendarClock, Receipt, Users } from "lucide-react";

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
  Empty,
  EmptyContent,
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
import { initials } from "./format";
import type { Group, RecurringPayment, Tab } from "./types";

const LIST_LIMIT = 3;

function viewAllLabel(total: number, shown: number) {
  return total > shown ? `View all (${total})` : "View all";
}

export function UpcomingPaymentsCard({
  payments,
}: {
  payments: Array<RecurringPayment & { daysUntil: number }>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Upcoming payments</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/recurring-payments">View all</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
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
            {payments.map((payment) => (
              <Item key={payment.id} variant="outline" size="sm" asChild>
                <Link href={`/recurring-payments/${payment.id}`}>
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
                </Link>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}

export function GroupsCard({ groups }: { groups: Group[] }) {
  const shown = groups.slice(0, LIST_LIMIT);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Your groups</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/groups">{viewAllLabel(groups.length, shown.length)}</Link>
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
            <EmptyContent>
              <Button size="sm" asChild>
                <Link href="/groups?new=1">Create group</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ItemGroup className="gap-2">
            {shown.map((group) => (
              <Item key={group.id} variant="outline" size="sm" asChild>
                <Link href={`/groups/${group.id}`}>
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
                </Link>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}

export function TabsCard({
  tabs,
  totalActive,
  onMarkPaid,
}: {
  tabs: Tab[];
  totalActive: number;
  onMarkPaid: (tabId: number) => void;
}) {
  const shown = tabs.slice(0, LIST_LIMIT);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Your tabs</CardTitle>
        <Button variant="outline" size="sm" asChild>
          <Link href="/tabs">{viewAllLabel(totalActive, shown.length)}</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {tabs.length === 0 ? (
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
            <EmptyContent>
              <Button size="sm" asChild>
                <Link href="/tabs?new=1">Add tab</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <ItemGroup className="gap-2">
            {shown.map((tab) => (
              <Item key={tab.id} variant="outline" size="sm">
                <ItemMedia>
                  <Avatar className="size-9">
                    <AvatarFallback>{initials(tab.personName)}</AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{tab.personName}</ItemTitle>
                  <Badge variant="secondary" className="w-fit">
                    {tab.status === "lending" ? "Owes you" : "You owe"}
                  </Badge>
                </ItemContent>
                <ItemActions>
                  <span className="font-semibold tabular-nums">
                    ${tab.amount.toFixed(2)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onMarkPaid(tab.id)}
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
  );
}
