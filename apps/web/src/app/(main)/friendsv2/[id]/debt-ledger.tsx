"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import type { SerializedDebt, SerializedDebtTransaction, FriendDashboardData } from "./types"

interface DebtLedgerProps {
  data: FriendDashboardData
  onConfirmTransaction: (txId: number) => void
  onRejectTransaction: (txId: number) => void
}

type Tab = "active" | "pending" | "settled"

function formatDate(dateStr: string) {
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
}: {
  debt: SerializedDebt
  currentUserId: string
  settled?: boolean
}) {
  const youLent = debt.lenderId === currentUserId
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/50 last:border-b-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className={"text-sm font-medium truncate " + (settled ? "text-muted-foreground" : "text-foreground")}>
          {debt.description ?? "No description"}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDate(debt.createdAt)} · {youLent ? "You lent" : "You borrowed"}
        </span>
      </div>
      <span
        className={
          "text-sm font-semibold tabular-nums flex-shrink-0 ml-4 " +
          (settled
            ? "text-muted-foreground line-through"
            : youLent
              ? "text-green"
              : "text-red")
        }
      >
        {youLent ? "+" : "-"}${debt.amount.toFixed(2)}
      </span>
    </div>
  )
}

function PendingRow({
  tx,
  currentUserId,
  onConfirm,
  onReject,
}: {
  tx: SerializedDebtTransaction
  currentUserId: string
  onConfirm: () => void
  onReject: () => void
}) {
  const isRequester = tx.requesterId === currentUserId
  const typeLabel =
    tx.type === "drop"
      ? "Drop"
      : tx.type === "modify"
        ? "Modify"
        : "Mark paid"

  const needsMyApproval =
    tx.status === "pending" &&
    !isRequester &&
    ((tx.debt.lenderId === currentUserId && !tx.lenderApproved) ||
      (tx.debt.borrowerId === currentUserId && !tx.borrowerApproved))

  return (
    <div className="flex items-start justify-between py-3 border-b border-border/50 last:border-b-0">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {tx.debt.description ?? "No description"}
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {typeLabel}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          ${(tx.proposedAmount ?? tx.debt.amount).toFixed(2)}
          {tx.reason && <> &mdash; {tx.reason}</>}
        </span>
        {isRequester && (
          <span className="text-xs text-muted-foreground italic">
            Waiting for approval
          </span>
        )}
      </div>

      {needsMyApproval && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2.5 text-xs"
            onClick={onReject}
          >
            Decline
          </Button>
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            onClick={onConfirm}
          >
            Approve
          </Button>
        </div>
      )}
    </div>
  )
}

export function DebtLedger({
  data,
  onConfirmTransaction,
  onRejectTransaction,
}: DebtLedgerProps) {
  const { activeDebts, pendingTransactions, settledDebts, currentUserId } = data
  const [tab, setTab] = useState<Tab>("active")

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "active", label: "Active", count: activeDebts.length },
    { key: "pending", label: "Pending", count: pendingTransactions.length },
    { key: "settled", label: "Settled", count: settledDebts.length },
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
              "px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px " +
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
      {tab === "active" && (
        activeDebts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No active debts with {data.friend.name}
            </p>
          </div>
        ) : (
          <div>
            {activeDebts.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )
      )}

      {tab === "pending" && (
        pendingTransactions.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No pending requests
            </p>
          </div>
        ) : (
          <div>
            {pendingTransactions.map((tx) => (
              <PendingRow
                key={tx.id}
                tx={tx}
                currentUserId={currentUserId}
                onConfirm={() => onConfirmTransaction(tx.id)}
                onReject={() => onRejectTransaction(tx.id)}
              />
            ))}
          </div>
        )
      )}

      {tab === "settled" && (
        settledDebts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No settled debts yet
            </p>
          </div>
        ) : (
          <div>
            {settledDebts.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                currentUserId={currentUserId}
                settled
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}
