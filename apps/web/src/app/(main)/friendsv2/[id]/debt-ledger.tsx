"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
} from "lucide-react"
import type { SerializedDebt, SerializedDebtTransaction, FriendDashboardData } from "./types"

interface DebtLedgerProps {
  data: FriendDashboardData
  onConfirmTransaction: (txId: number) => void
  onRejectTransaction: (txId: number) => void
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateStr))
}

function DebtRow({
  debt,
  currentUserId,
}: {
  debt: SerializedDebt
  currentUserId: string
}) {
  const youLent = debt.lenderId === currentUserId
  return (
    <div
      className={
        "flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-muted/40 transition-colors group border-l-2 " +
        (youLent ? "border-l-green" : "border-l-red")
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex-shrink-0 h-7 w-7 rounded flex items-center justify-center bg-secondary text-muted-foreground">
          <Pencil size={12} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[13px] text-foreground font-medium truncate">
            {debt.description ?? "No description"}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(debt.createdAt)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex flex-col items-end">
          <span
            className={
              "text-[13px] font-semibold tabular-nums " +
              (youLent ? "text-green" : "text-red")
            }
          >
            {youLent ? "+" : "-"}${debt.amount.toFixed(2)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {youLent ? "you lent" : "you owe"}
          </span>
        </div>
      </div>
    </div>
  )
}

function PendingBanner({
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
      ? "Drop Debt"
      : tx.type === "modify"
        ? "Modify Debt"
        : "Mark Paid"
  const needsMyApproval =
    tx.status === "pending" &&
    !isRequester &&
    ((tx.debt.lenderId === currentUserId && !tx.lenderApproved) ||
      (tx.debt.borrowerId === currentUserId && !tx.borrowerApproved))

  return (
    <div className="flex items-start justify-between py-2.5 px-3 rounded-md bg-yellow/5 border border-yellow/20 mb-2">
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex-shrink-0 h-7 w-7 rounded flex items-center justify-center bg-yellow/10 text-yellow mt-0.5">
          <AlertTriangle size={12} />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-foreground font-medium">
              {typeLabel}
            </span>
            <Badge
              variant="outline"
              className={
                "text-[10px] px-1.5 h-4 " +
                (tx.type === "drop"
                  ? "border-red/40 text-red"
                  : tx.type === "modify"
                    ? "border-primary/40 text-primary"
                    : "border-green/40 text-green")
              }
            >
              {tx.type}
            </Badge>
          </div>
          <span className="text-[12px] text-muted-foreground truncate">
            {tx.debt.description ?? "No description"} &mdash; $
            {tx.proposedAmount != null
              ? tx.proposedAmount.toFixed(2)
              : tx.debt.amount.toFixed(2)}
          </span>
          {tx.reason && (
            <span className="text-[11px] text-muted-foreground/60 italic">
              &ldquo;{tx.reason}&rdquo;
            </span>
          )}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[11px] text-muted-foreground">
              Lender{" "}
              {tx.lenderApproved ? (
                <span className="text-green">approved</span>
              ) : (
                <span className="text-muted-foreground/60">pending</span>
              )}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Borrower{" "}
              {tx.borrowerApproved ? (
                <span className="text-green">approved</span>
              ) : (
                <span className="text-muted-foreground/60">pending</span>
              )}
            </span>
          </div>
        </div>
      </div>
      {needsMyApproval && (
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          <Button
            size="sm"
            className="h-6 px-2 text-[11px] bg-green/10 text-green hover:bg-green/20 border-0"
            variant="outline"
            onClick={onConfirm}
          >
            <Check size={11} className="mr-1" />
            Confirm
          </Button>
          <Button
            size="sm"
            className="h-6 px-2 text-[11px] bg-red/10 text-red hover:bg-red/20 border-0"
            variant="outline"
            onClick={onReject}
          >
            <X size={11} className="mr-1" />
            Object
          </Button>
        </div>
      )}
      {isRequester && (
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 h-4 border-border/40 text-muted-foreground flex-shrink-0"
        >
          Awaiting
        </Badge>
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
  const [showSettled, setShowSettled] = useState(false)

  return (
    <Card className="bg-card border-border/40">
      <CardHeader className="pb-0 pt-4 px-4">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-foreground">
            Debt Lifecycle Ledger
          </span>
          <Badge
            variant="outline"
            className="text-[11px] h-5 px-2 border-border/40 text-muted-foreground"
          >
            {activeDebts.length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-3">
        {/* Pending approvals as inline banners */}
        {pendingTransactions.length > 0 && (
          <div className="mb-3">
            {pendingTransactions.map((tx) => (
              <PendingBanner
                key={tx.id}
                tx={tx}
                currentUserId={currentUserId}
                onConfirm={() => onConfirmTransaction(tx.id)}
                onReject={() => onRejectTransaction(tx.id)}
              />
            ))}
          </div>
        )}

        {/* Active debts */}
        {activeDebts.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-[13px] text-muted-foreground">
              No active debts with {data.friend.name}.
            </p>
            <p className="text-[11px] text-muted-foreground/60 mt-1">
              Use &ldquo;Add Debt&rdquo; to log one.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {activeDebts.map((debt) => (
              <DebtRow
                key={debt.id}
                debt={debt}
                currentUserId={currentUserId}
              />
            ))}
          </div>
        )}

        {/* Settled debts link */}
        {settledDebts.length > 0 && (
          <div className="mt-4">
            <button
              className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowSettled((o) => !o)}
            >
              {showSettled ? (
                <ChevronUp size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
              View {settledDebts.length} settled debt
              {settledDebts.length !== 1 && "s"}
            </button>

            {showSettled && (
              <div className="mt-2 border-t border-border/20 pt-2 flex flex-col gap-0.5">
                {settledDebts.map((debt) => (
                  <DebtRow
                    key={debt.id}
                    debt={debt}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
