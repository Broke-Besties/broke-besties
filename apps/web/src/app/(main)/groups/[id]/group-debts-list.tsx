"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { User } from "@supabase/supabase-js"

type Debt = {
  id: number
  amount: number
  description: string | null
  status: string
  createdAt: Date | string
  lender: { id: string; name: string; email: string }
  borrower: { id: string; name: string; email: string }
}

type GroupDebtsListProps = {
  debts: Debt[]
  currentUser: User | null
  onUpdateStatus: (debtId: number, newStatus: string) => Promise<void>
}

type Tab = "pending" | "paid"

function formatDate(dateStr: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateStr))
}

function DebtRow({
  debt,
  currentUserId,
  settled,
  onMarkPaid,
}: {
  debt: Debt
  currentUserId?: string
  settled?: boolean
  onMarkPaid?: () => void
}) {
  const isLender = debt.lender.id === currentUserId
  const isBorrower = debt.borrower.id === currentUserId

  const label = isLender
    ? `${debt.borrower.name || debt.borrower.email} owes you`
    : isBorrower
      ? `You owe ${debt.lender.name || debt.lender.email}`
      : `${debt.borrower.name || debt.borrower.email} owes ${debt.lender.name || debt.lender.email}`

  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-b-0 gap-3">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          className={
            "text-sm font-medium truncate " +
            (settled ? "text-muted-foreground" : "text-foreground")
          }
        >
          {debt.description ?? "No description"}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(debt.createdAt)} · {label}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-2">
        {!settled && onMarkPaid && isLender && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs hidden sm:inline-flex"
            onClick={onMarkPaid}
          >
            Mark paid
          </Button>
        )}
        <span
          className={
            "text-sm font-semibold tabular-nums " +
            (settled
              ? "text-muted-foreground line-through"
              : isLender
                ? "text-green"
                : isBorrower
                  ? "text-red"
                  : "text-foreground")
          }
        >
          ${debt.amount.toFixed(2)}
        </span>
      </div>
    </div>
  )
}

export function GroupDebtsList({ debts, currentUser, onUpdateStatus }: GroupDebtsListProps) {
  const [tab, setTab] = useState<Tab>("pending")

  const pendingDebts = debts.filter((d) => d.status === "pending")
  const paidDebts = debts.filter((d) => d.status === "paid")

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "pending", label: "Active", count: pendingDebts.length },
    { key: "paid", label: "Settled", count: paidDebts.length },
  ]

  return (
    <div>
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px cursor-pointer " +
              (tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground")
            }
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "pending" && (
        pendingDebts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No active debts</p>
          </div>
        ) : (
          <div>
            {pendingDebts.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                currentUserId={currentUser?.id}
                onMarkPaid={() => onUpdateStatus(debt.id, "paid")}
              />
            ))}
          </div>
        )
      )}

      {tab === "paid" && (
        paidDebts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No settled debts yet</p>
          </div>
        ) : (
          <div>
            {paidDebts.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                currentUserId={currentUser?.id}
                settled
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}
