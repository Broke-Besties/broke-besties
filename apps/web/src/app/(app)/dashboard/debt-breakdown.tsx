"use client";

import { useMemo, useState } from "react";
import { Label, Pie, PieChart } from "recharts";
import { Inbox } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { chartColor } from "@/lib/chart-colors";
import type { Debt } from "./types";

// Top people shown individually; everyone else folds into an "Other" slice so
// the 5-token chart palette never recycles into identical colors.
const MAX_PEOPLE = 4;

type View = "owed" | "owing";

export function DebtBreakdown({
  lendingDebts,
  borrowingDebts,
}: {
  lendingDebts: Debt[];
  borrowingDebts: Debt[];
}) {
  const [view, setView] = useState<View>("owed");

  const { chartData, chartConfig, chartTotal } = useMemo(() => {
    const relevantDebts = (view === "owed" ? lendingDebts : borrowingDebts).filter(
      (debt) => debt.status === "pending"
    );

    const personData = new Map<string, number>();
    for (const debt of relevantDebts) {
      const personObj = view === "owed" ? debt.borrower : debt.lender;
      const person = personObj.name || personObj.email;
      personData.set(person, (personData.get(person) ?? 0) + debt.amount);
    }

    const entries = Array.from(personData.entries()).sort((a, b) => b[1] - a[1]);
    const shown = entries.slice(0, MAX_PEOPLE);
    const rest = entries.slice(MAX_PEOPLE);
    if (rest.length > 0) {
      shown.push([
        rest.length === 1 ? rest[0][0] : `Other (${rest.length})`,
        rest.reduce((sum, [, amount]) => sum + amount, 0),
      ]);
    }

    const data = shown.map(([person, amount], i) => ({
      key: `person-${i}`,
      person,
      amount,
      fill: chartColor(i),
    }));

    const config: ChartConfig = { amount: { label: "Amount" } };
    shown.forEach(([person], i) => {
      config[`person-${i}`] = { label: person, color: chartColor(i) };
    });

    const total = entries.reduce((sum, [, amount]) => sum + amount, 0);

    return { chartData: data, chartConfig: config, chartTotal: total };
  }, [view, lendingDebts, borrowingDebts]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Debt breakdown</CardTitle>
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as View)}
          className="w-auto"
        >
          <TabsList className="h-8">
            <TabsTrigger value="owed" className="text-xs">
              Owed to you
            </TabsTrigger>
            <TabsTrigger value="owing" className="text-xs">
              You owe
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="flex-1">
        {chartData.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>
                {view === "owed" ? "No one owes you" : "You owe no one"}
              </EmptyTitle>
              <EmptyDescription>Pending debts will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[260px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    nameKey="key"
                    formatter={(value, name, item) => (
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-muted-foreground">
                          {item.payload.person}
                        </span>
                        <span className="font-mono tabular-nums">
                          ${Number(value).toFixed(2)}
                        </span>
                      </span>
                    )}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="amount"
                nameKey="key"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-2xl font-bold tabular-nums"
                          >
                            ${chartTotal.toFixed(0)}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 22}
                            className="fill-muted-foreground text-xs"
                          >
                            {view === "owed" ? "owed to you" : "you owe"}
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
              <ChartLegend
                content={<ChartLegendContent nameKey="key" />}
                className="flex-wrap gap-2 *:basis-auto"
              />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
