"use client";

import { useMemo } from "react";
import NumberFlow from "@number-flow/react";
import { CalendarClock, Repeat, TrendingDown, TrendingUp } from "lucide-react";

import { StatCard } from "@/components/stat-card";
import { formatShortDate, getNextRenewalDate } from "./format";
import type { RecurringPayment } from "./types";

/**
 * Four static, informational stat cards. Chart view switching lives in the
 * debt-breakdown card's Tabs — never here.
 */
export function StatCards({
  lendingTotal,
  borrowingTotal,
  recurringPayments,
}: {
  lendingTotal: number;
  borrowingTotal: number;
  recurringPayments: RecurringPayment[];
}) {
  const nextRenewalDate = useMemo(() => {
    if (recurringPayments.length === 0) return null;
    const dates = recurringPayments.map((p) => getNextRenewalDate(p));
    return dates.reduce((min, d) => (d < min ? d : min), dates[0]);
  }, [recurringPayments]);

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
      <StatCard
        label="Active recurring"
        icon={Repeat}
        value={<NumberFlow value={recurringPayments.length} />}
      />
      <StatCard
        label="Next renewal"
        icon={CalendarClock}
        value={nextRenewalDate ? formatShortDate(nextRenewalDate) : "None"}
      />
    </div>
  );
}
