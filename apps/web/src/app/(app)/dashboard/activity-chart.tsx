"use client";

import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Activity } from "lucide-react";
import { chartColor } from "@/lib/chart-colors";
import { bucketByMonth } from "@/lib/chart-series";

type Debt = {
  amount: number;
  createdAt: Date | string;
  lender: { id: string };
  borrower: { id: string };
};

const config = {
  owed: { label: "Owed to you", color: chartColor(0) },
  owe: { label: "You owe", color: chartColor(1) },
} satisfies ChartConfig;

export function ActivityChart({
  debts,
  currentUserId,
}: {
  debts: Debt[];
  currentUserId: string;
}) {
  const data = useMemo(
    () =>
      bucketByMonth(debts, 6, (d) => d.createdAt, {
        owed: (d) => (d.lender.id === currentUserId ? d.amount : 0),
        owe: (d) => (d.borrower.id === currentUserId ? d.amount : 0),
      }),
    [debts, currentUserId]
  );

  const hasData = data.some(
    (r) => (r.owed as number) + (r.owe as number) > 0
  );

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Activity over time</CardTitle>
        <CardDescription>
          Owed to you vs. what you owe, by month
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {hasData ? (
          <ChartContainer config={config} className="max-h-[240px] w-full">
            <AreaChart data={data} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    formatter={(value, name) => (
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {config[name as keyof typeof config]?.label ?? name}
                        </span>
                        <span className="font-mono tabular-nums">
                          ${Number(value).toFixed(2)}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Area
                dataKey="owed"
                type="natural"
                stackId="a"
                stroke="var(--color-owed)"
                fill="var(--color-owed)"
                fillOpacity={0.4}
              />
              <Area
                dataKey="owe"
                type="natural"
                stackId="a"
                stroke="var(--color-owe)"
                fill="var(--color-owe)"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Activity />
              </EmptyMedia>
              <EmptyTitle>Not enough activity yet</EmptyTitle>
              <EmptyDescription>
                Your monthly trend shows up here as you add debts.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
