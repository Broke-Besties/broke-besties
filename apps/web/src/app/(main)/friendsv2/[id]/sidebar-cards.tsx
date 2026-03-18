"use client"

import Link from "next/link"
import type { FriendDashboardData } from "./types"

interface SidebarCardsProps {
  data: FriendDashboardData
}

function frequencyLabel(days: number) {
  if (days === 1) return "Daily"
  if (days === 7) return "Weekly"
  if (days === 14) return "Bi-weekly"
  if (days === 30) return "Monthly"
  if (days === 90) return "Quarterly"
  if (days === 365) return "Yearly"
  return `Every ${days}d`
}

export function SidebarCards({ data }: SidebarCardsProps) {
  const { commonGroups, sharedRecurring, activeDebts, settledDebts, pendingTransactions, currentUserId } = data

  const totalLent = activeDebts
    .filter((d) => d.lenderId === currentUserId)
    .reduce((s, d) => s + d.amount, 0)
  const totalOwed = activeDebts
    .filter((d) => d.borrowerId === currentUserId)
    .reduce((s, d) => s + d.amount, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Summary */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Summary
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">You lent</p>
            <p className="text-lg font-semibold text-green tabular-nums">
              ${totalLent.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">You owe</p>
            <p className="text-lg font-semibold text-red tabular-nums">
              ${totalOwed.toFixed(2)}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Settled</p>
            <p className="text-lg font-semibold text-foreground tabular-nums">
              {settledDebts.length}
            </p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-lg font-semibold text-foreground tabular-nums">
              {pendingTransactions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Groups */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Shared groups
        </h3>
        {commonGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No groups in common</p>
        ) : (
          <div className="flex flex-col gap-1">
            {commonGroups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="flex items-center justify-between py-2 px-2.5 -mx-2.5 rounded-md hover:bg-muted transition-colors text-sm cursor-pointer"
              >
                <span className="text-foreground">{group.name}</span>
                <span className="text-xs text-muted-foreground">
                  {group.memberCount} members
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Recurring */}
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Recurring payments
        </h3>
        {sharedRecurring.length === 0 ? (
          <p className="text-sm text-muted-foreground">No shared recurring payments</p>
        ) : (
          <div className="flex flex-col gap-1">
            {sharedRecurring.map((payment) => {
              const myShare =
                (payment.amount * payment.splitPercentage) / 100
              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between py-2 px-2.5 -mx-2.5 rounded-md"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm text-foreground truncate">
                      {payment.description ?? "Recurring"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {frequencyLabel(payment.frequency)}
                    </span>
                  </div>
                  <span className="text-sm font-medium tabular-nums text-foreground flex-shrink-0 ml-3">
                    ${myShare.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
