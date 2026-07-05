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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { chartColor } from "@/lib/chart-colors";
import { bucketByMonth } from "@/lib/chart-series";

type Debt = {
  amount: number;
  createdAt: Date | string;
};

const config = {
  total: { label: "Spending", color: chartColor(0) },
} satisfies ChartConfig;

export function GroupSpendingChart({ debts }: { debts: Debt[] }) {
  const data = useMemo(
    () =>
      bucketByMonth(debts, 6, (d) => d.createdAt, {
        total: (d) => d.amount,
      }),
    [debts]
  );

  const hasData = data.some((r) => (r.total as number) > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending over time</CardTitle>
        <CardDescription>Total group debt added per month</CardDescription>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <ChartContainer config={config} className="max-h-[220px] w-full">
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
                    formatter={(value) => (
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-muted-foreground">Spending</span>
                        <span className="font-mono tabular-nums">
                          ${Number(value).toFixed(2)}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Area
                dataKey="total"
                type="natural"
                stroke="var(--color-total)"
                fill="var(--color-total)"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Not enough activity yet — monthly spending shows up here.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
