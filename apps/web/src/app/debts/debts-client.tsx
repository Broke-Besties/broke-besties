'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { updateDebtStatus } from '@/app/dashboard/actions'
import type { User } from '@supabase/supabase-js'

type Debt = {
  id: number
  amount: number
  description: string | null
  status: string
  createdAt: Date | string
  lender: {
    id: string
    email: string
  }
  borrower: {
    id: string
    email: string
  }
  group: {
    id: number
    name: string
  } | null
}

type DebtsPageClientProps = {
  initialDebts: Debt[]
  currentUser: User
}

type ViewFilter = 'all' | 'lending' | 'borrowing'
type StatusFilter = 'all' | 'pending' | 'paid'

export default function DebtsPageClient({
  initialDebts,
  currentUser,
}: DebtsPageClientProps) {
  const [debts, setDebts] = useState<Debt[]>(initialDebts)
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleUpdateStatus = async (debtId: number, newStatus: string) => {
    const oldStatus = debts.find(d => d.id === debtId)?.status

    setDebts(prevDebts =>
      prevDebts.map(debt =>
        debt.id === debtId ? { ...debt, status: newStatus } : debt
      )
    )

    try {
      const result = await updateDebtStatus(debtId, newStatus)

      if (!result.success) {
        setError(result.error || 'Failed to update status')
        if (oldStatus) {
          setDebts(prevDebts =>
            prevDebts.map(debt =>
              debt.id === debtId ? { ...debt, status: oldStatus } : debt
            )
          )
        }
      }
    } catch {
      setError('An error occurred while updating the status')
      if (oldStatus) {
        setDebts(prevDebts =>
          prevDebts.map(debt =>
            debt.id === debtId ? { ...debt, status: oldStatus } : debt
          )
        )
      }
    }
  }

  // Calculate totals
  const lendingDebts = debts.filter(debt => debt.lender.id === currentUser.id)
  const borrowingDebts = debts.filter(debt => debt.borrower.id === currentUser.id)

  const totalLending = lendingDebts
    .filter(d => d.status === 'pending')
    .reduce((sum, debt) => sum + debt.amount, 0)
  const totalBorrowing = borrowingDebts
    .filter(d => d.status === 'pending')
    .reduce((sum, debt) => sum + debt.amount, 0)
  const netBalance = totalLending - totalBorrowing

  // Apply filters
  let filteredDebts = debts
  if (viewFilter === 'lending') {
    filteredDebts = lendingDebts
  } else if (viewFilter === 'borrowing') {
    filteredDebts = borrowingDebts
  }

  if (statusFilter !== 'all') {
    filteredDebts = filteredDebts.filter(d => d.status === statusFilter)
  }

  // Sort by date (most recent first)
  filteredDebts = [...filteredDebts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  const getDebtDirection = (debt: Debt) => {
    return debt.lender.id === currentUser.id ? 'lending' : 'borrowing'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Debts</h1>
        <p className="text-sm text-muted-foreground">
          Track money you've lent and borrowed
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>You are owed</CardDescription>
            <CardTitle className="text-2xl text-emerald-600 dark:text-emerald-400">
              ${totalLending.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {lendingDebts.filter(d => d.status === 'pending').length} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>You owe</CardDescription>
            <CardTitle className="text-2xl text-rose-600 dark:text-rose-400">
              ${totalBorrowing.toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {borrowingDebts.filter(d => d.status === 'pending').length} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net balance</CardDescription>
            <CardTitle className={cn(
              'text-2xl',
              netBalance >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            )}>
              {netBalance >= 0 ? '+' : '-'}${Math.abs(netBalance).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {netBalance >= 0 ? 'in your favor' : 'you owe more'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        {/* View Filter */}
        <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
          {(['all', 'lending', 'borrowing'] as const).map((view) => (
            <button
              key={view}
              onClick={() => setViewFilter(view)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                viewFilter === view
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {view === 'all' && `All (${debts.length})`}
              {view === 'lending' && `Lending (${lendingDebts.length})`}
              {view === 'borrowing' && `Borrowing (${borrowingDebts.length})`}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex gap-1">
          {(['all', 'pending', 'paid'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === status
                  ? status === 'pending'
                    ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300'
                    : status === 'paid'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    : 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Debts List */}
      {filteredDebts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">No debts found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {statusFilter !== 'all' || viewFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Create a debt from a group page'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredDebts.map((debt) => {
            const direction = getDebtDirection(debt)
            const otherPerson = direction === 'lending' ? debt.borrower : debt.lender

            return (
              <Card
                key={debt.id}
                className="cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5"
                onClick={() => router.push(`/debts/${debt.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left side - Info */}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          direction === 'lending'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        )}>
                          {direction === 'lending' ? 'Lending' : 'Borrowing'}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-xs',
                            debt.status === 'pending' && 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
                            debt.status === 'paid' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                          )}
                        >
                          {debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
                        </Badge>
                      </div>

                      <p className="font-medium truncate">
                        {direction === 'lending' ? 'To: ' : 'From: '}
                        {otherPerson.email}
                      </p>

                      {debt.description && (
                        <p className="text-sm text-muted-foreground truncate">
                          {debt.description}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {debt.group && (
                          <span className="truncate">
                            {debt.group.name}
                          </span>
                        )}
                        <span>
                          {new Date(debt.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Right side - Amount & Action */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={cn(
                          'text-xl font-semibold',
                          direction === 'lending'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        )}>
                          {direction === 'lending' ? '+' : '-'}${debt.amount.toFixed(2)}
                        </p>
                      </div>

                      <div onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={debt.status}
                          onValueChange={(value) => handleUpdateStatus(debt.id, value)}
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
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
