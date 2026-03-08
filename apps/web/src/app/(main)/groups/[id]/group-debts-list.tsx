'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

type Debt = {
  id: number
  amount: number
  description: string | null
  status: string
  createdAt: Date | string
  lender: {
    id: string
    name: string
    email: string
  }
  borrower: {
    id: string
    name: string
    email: string
  }
}

type GroupDebtsListProps = {
  debts: Debt[]
  currentUser: User | null
  onUpdateStatus: (debtId: number, newStatus: string) => Promise<void>
}

type FilterStatus = 'all' | 'pending' | 'paid'

export function GroupDebtsList({ debts, currentUser, onUpdateStatus }: GroupDebtsListProps) {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const router = useRouter()

  const filteredDebts = debts.filter(debt => {
    if (filter === 'all') return true
    return debt.status === filter
  })

  const statusCounts = {
    all: debts.length,
    pending: debts.filter(d => d.status === 'pending').length,
    paid: debts.filter(d => d.status === 'paid').length,
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>Group debts</CardTitle>
          <CardDescription>{debts.length} total</CardDescription>
        </div>
        <Badge variant="secondary">{debts.length}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            All ({statusCounts.all})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === 'pending'
                ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            Pending ({statusCounts.pending})
          </button>
          <button
            onClick={() => setFilter('paid')}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              filter === 'paid'
                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            Paid ({statusCounts.paid})
          </button>
        </div>

        {/* Debts list */}
        <div className="space-y-3">
          {filteredDebts.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
              {filter === 'all' ? 'No debts in this group yet.' : `No ${filter} debts.`}
            </div>
          ) : (
            filteredDebts.map((debt) => {
              const isLender = currentUser?.id === debt.lender.id
              const isBorrower = currentUser?.id === debt.borrower.id
              const isInvolved = isLender || isBorrower
              return (
                <div
                  key={debt.id}
                  onClick={() => router.push(`/debts/${debt.id}`)}
                  className="cursor-pointer rounded-lg border bg-background p-4 shadow-sm transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="font-medium">
                        {isLender ? (
                          <span>
                            <span className="text-emerald-600 dark:text-emerald-400">You lent to</span> {debt.borrower.name || debt.borrower.email}
                          </span>
                        ) : isBorrower ? (
                          <span>
                            <span className="text-rose-600 dark:text-rose-400">You borrowed from</span> {debt.lender.name || debt.lender.email}
                          </span>
                        ) : (
                          <span>
                            <span className="text-muted-foreground">{debt.lender.name || debt.lender.email}</span>
                            {' → '}
                            <span className="text-muted-foreground">{debt.borrower.name || debt.borrower.email}</span>
                          </span>
                        )}
                      </div>
                      {debt.description && <div className="text-sm text-muted-foreground">{debt.description}</div>}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className={cn("text-lg font-semibold", !isInvolved && "text-muted-foreground")}>${debt.amount.toFixed(2)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {new Date(debt.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <Badge
                      variant="outline"
                      className={cn(
                        debt.status === 'pending' && 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
                        debt.status === 'paid' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                      )}
                    >
                      {debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
                    </Badge>

                    <div onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={debt.status}
                        onValueChange={(value) => onUpdateStatus(debt.id, value)}
                      >
                        <SelectTrigger size="sm" className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </Card>
  )
}

