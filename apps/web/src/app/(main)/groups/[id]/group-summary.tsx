"use client"

import { useMemo } from "react"

type Member = {
  id: number
  user: {
    id: string
    name: string
    email: string
  }
}

type Debt = {
  id: number
  amount: number
  description: string | null
  status: string
  lender: { id: string; name: string; email: string }
  borrower: { id: string; name: string; email: string }
}

type BalanceEntry = {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

interface GroupSummaryProps {
  members: Member[]
  debts: Debt[]
  currentUserId?: string
}

export function GroupSummary({ members, debts, currentUserId }: GroupSummaryProps) {
  const pendingDebts = useMemo(() => debts.filter((d) => d.status === "pending"), [debts])

  const balances = useMemo(() => {
    const netMap = new Map<string, number>()
    const userNames = new Map<string, string>()

    for (const debt of pendingDebts) {
      userNames.set(debt.lender.id, debt.lender.name || debt.lender.email)
      userNames.set(debt.borrower.id, debt.borrower.name || debt.borrower.email)

      const key1 = `${debt.borrower.id}->${debt.lender.id}`
      const key2 = `${debt.lender.id}->${debt.borrower.id}`

      if (netMap.has(key2)) {
        const current = netMap.get(key2)!
        const newAmount = current - debt.amount
        if (newAmount > 0) {
          netMap.set(key2, newAmount)
        } else if (newAmount < 0) {
          netMap.delete(key2)
          netMap.set(key1, -newAmount)
        } else {
          netMap.delete(key2)
        }
      } else {
        netMap.set(key1, (netMap.get(key1) || 0) + debt.amount)
      }
    }

    const entries: BalanceEntry[] = []
    for (const [key, amount] of netMap) {
      if (amount > 0) {
        const [fromId, toId] = key.split("->")
        entries.push({
          fromId,
          fromName: userNames.get(fromId) || fromId,
          toId,
          toName: userNames.get(toId) || toId,
          amount,
        })
      }
    }

    return entries.sort((a, b) => {
      // Show current user's balances first
      const aInvolved = a.fromId === currentUserId || a.toId === currentUserId
      const bInvolved = b.fromId === currentUserId || b.toId === currentUserId
      if (aInvolved && !bInvolved) return -1
      if (!aInvolved && bInvolved) return 1
      return b.amount - a.amount
    })
  }, [pendingDebts, currentUserId])

  const myOwed = useMemo(
    () => pendingDebts.filter((d) => d.lender.id === currentUserId).reduce((s, d) => s + d.amount, 0),
    [pendingDebts, currentUserId]
  )
  const myOwe = useMemo(
    () => pendingDebts.filter((d) => d.borrower.id === currentUserId).reduce((s, d) => s + d.amount, 0),
    [pendingDebts, currentUserId]
  )

  return (
    <div>
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
        Balances
      </h3>

      {/* Your summary */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">You&apos;re owed</p>
          <p className="text-lg font-semibold text-green tabular-nums">
            ${myOwed.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground">You owe</p>
          <p className="text-lg font-semibold text-red tabular-nums">
            ${myOwe.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Balance list */}
      {balances.length === 0 ? (
        <p className="text-sm text-muted-foreground">All settled up</p>
      ) : (
        <div className="flex flex-col gap-1">
          {balances.map((b, i) => {
            const youOwe = b.fromId === currentUserId
            const theyOwe = b.toId === currentUserId
            return (
              <div
                key={i}
                className="flex items-center justify-between py-2 px-2.5 -mx-2.5 rounded-md"
              >
                <span className="text-sm text-foreground">
                  {youOwe ? "You" : b.fromName} owes {theyOwe ? "you" : b.toName}
                </span>
                <span
                  className={
                    "text-sm font-medium tabular-nums flex-shrink-0 ml-3 " +
                    (youOwe ? "text-red" : theyOwe ? "text-green" : "text-foreground")
                  }
                >
                  ${b.amount.toFixed(2)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
