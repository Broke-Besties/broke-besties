"use client";

import NumberFlow from "@number-flow/react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/stat-card";

/** The two outstanding balances at a glance. */
export function StatCards({
  lendingTotal,
  borrowingTotal,
}: {
  lendingTotal: number;
  borrowingTotal: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard
        label="You are owed"
        icon={TrendingUp}
        value={
          <NumberFlow
            value={lendingTotal}
            format={{ style: "currency", currency: "USD" }}
          />
        }
      />
      <StatCard
        label="You owe"
        icon={TrendingDown}
        value={
          <NumberFlow
            value={borrowingTotal}
            format={{ style: "currency", currency: "USD" }}
          />
        }
      />
    </div>
  );
}
