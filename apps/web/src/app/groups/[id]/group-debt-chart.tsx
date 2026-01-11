'use client'

import { useState, useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | 'pending' | 'paid'

ChartJS.register(ArcElement, Tooltip, Legend)

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

type GroupDebtChartProps = {
  members: Member[]
  debts: Debt[]
  currentUserId?: string
}

type BalanceEntry = {
  fromId: string
  fromName: string
  toId: string
  toName: string
  amount: number
}

// Muted color palette that matches the app's theme
const COLORS = [
  'hsl(215 20% 55% / 0.7)',   // muted slate
  'hsl(220 15% 45% / 0.7)',   // darker slate
  'hsl(200 18% 50% / 0.7)',   // muted blue-gray
  'hsl(180 12% 55% / 0.7)',   // muted teal-gray
  'hsl(240 10% 50% / 0.7)',   // muted purple-gray
  'hsl(160 15% 50% / 0.7)',   // muted sage
  'hsl(210 25% 60% / 0.7)',   // soft blue
  'hsl(190 20% 55% / 0.7)',   // soft cyan
]

const BORDER_COLORS = [
  'hsl(215 20% 45%)',
  'hsl(220 15% 35%)',
  'hsl(200 18% 40%)',
  'hsl(180 12% 45%)',
  'hsl(240 10% 40%)',
  'hsl(160 15% 40%)',
  'hsl(210 25% 50%)',
  'hsl(190 20% 45%)',
]

export function GroupDebtChart({ members, debts, currentUserId }: GroupDebtChartProps) {
  // Selected member IDs for filtering
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => {
    return new Set(members.map(m => m.user.id))
  })
  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedMemberIds(new Set(members.map(m => m.user.id)))
  }

  const selectNone = () => {
    setSelectedMemberIds(new Set())
  }

  // Status counts for filter badges
  const statusCounts = useMemo(() => ({
    all: debts.length,
    pending: debts.filter(d => d.status === 'pending').length,
    paid: debts.filter(d => d.status === 'paid').length,
  }), [debts])

  // Calculate net balances between selected members
  const balances = useMemo(() => {
    // Filter debts by status and selected members
    const relevantDebts = debts.filter(
      d => (statusFilter === 'all' || d.status === statusFilter) &&
           selectedMemberIds.has(d.lender.id) &&
           selectedMemberIds.has(d.borrower.id)
    )

    // Build a map of net balances: key = "fromId->toId", value = amount owed
    const netMap = new Map<string, number>()
    const userNames = new Map<string, string>()

    for (const debt of relevantDebts) {
      userNames.set(debt.lender.id, debt.lender.name || debt.lender.email)
      userNames.set(debt.borrower.id, debt.borrower.name || debt.borrower.email)

      // borrower owes lender
      const key1 = `${debt.borrower.id}->${debt.lender.id}`
      const key2 = `${debt.lender.id}->${debt.borrower.id}`

      if (netMap.has(key2)) {
        // Reduce the opposite direction
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

    // Convert to array of balance entries
    const entries: BalanceEntry[] = []
    for (const [key, amount] of netMap) {
      if (amount > 0) {
        const [fromId, toId] = key.split('->')
        entries.push({
          fromId,
          fromName: userNames.get(fromId) || fromId,
          toId,
          toName: userNames.get(toId) || toId,
          amount,
        })
      }
    }

    // Sort by amount descending
    return entries.sort((a, b) => b.amount - a.amount)
  }, [debts, selectedMemberIds, statusFilter])

  // Chart data
  const chartData = useMemo(() => {
    if (balances.length === 0) {
      return {
        labels: ['No outstanding debts'],
        datasets: [{
          data: [1],
          backgroundColor: ['rgba(156, 163, 175, 0.3)'],
          borderColor: ['rgba(156, 163, 175, 0.5)'],
          borderWidth: 1,
        }],
      }
    }

    return {
      labels: balances.map(b => `${b.fromName} → ${b.toName}`),
      datasets: [{
        data: balances.map(b => b.amount),
        backgroundColor: balances.map((_, i) => COLORS[i % COLORS.length]),
        borderColor: balances.map((_, i) => BORDER_COLORS[i % BORDER_COLORS.length]),
        borderWidth: 2,
      }],
    }
  }, [balances])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 16,
          usePointStyle: true,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed
            return ` $${value.toFixed(2)}`
          },
        },
      },
    },
    cutout: '60%',
  }

  const totalOwed = balances.reduce((sum, b) => sum + b.amount, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Debt Overview</CardTitle>
        <CardDescription>Who owes who in this group</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status filter */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Filter by status</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter('all')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === 'all'
                  ? 'bg-primary/90 text-primary-foreground'
                  : 'bg-muted hover:bg-muted/70'
              )}
            >
              All ({statusCounts.all})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === 'pending'
                  ? 'bg-yellow-500/50 text-white'
                  : 'bg-yellow-500/10 text-yellow-700 hover:bg-yellow-500/20 dark:text-yellow-300'
              )}
            >
              Pending ({statusCounts.pending})
            </button>
            <button
              onClick={() => setStatusFilter('paid')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                statusFilter === 'paid'
                  ? 'bg-emerald-500/50 text-white'
                  : 'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
              )}
            >
              Paid ({statusCounts.paid})
            </button>
          </div>
        </div>

        {/* Member filter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filter by members</span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="h-7 px-2 text-xs"
              >
                Select all
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={selectNone}
                className="h-7 px-2 text-xs"
              >
                Clear
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => {
              const isSelected = selectedMemberIds.has(member.user.id)
              const isCurrentUser = member.user.id === currentUserId
              return (
                <button
                  key={member.id}
                  onClick={() => toggleMember(member.user.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/70'
                  )}
                >
                  {member.user.name || member.user.email}
                  {isCurrentUser && ' (you)'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Chart */}
        <div className="h-64">
          <Doughnut data={chartData} options={chartOptions} />
        </div>

        {/* Summary */}
        {balances.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {statusFilter === 'all' ? 'Total' : statusFilter === 'pending' ? 'Total outstanding' : 'Total paid'}
              </span>
              <span className="font-semibold">${totalOwed.toFixed(2)}</span>
            </div>
            <div className="space-y-1">
              {balances.map((balance, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {balance.fromName} owes {balance.toName}
                  </span>
                  <span className="font-medium">${balance.amount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {balances.length === 0 && selectedMemberIds.size > 0 && (
          <div className="border-t pt-4 text-center text-sm text-muted-foreground">
            No {statusFilter === 'all' ? '' : statusFilter + ' '}debts between selected members.
          </div>
        )}

        {selectedMemberIds.size === 0 && (
          <div className="border-t pt-4 text-center text-sm text-muted-foreground">
            Select members to see their debt relationships.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
