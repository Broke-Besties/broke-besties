'use client'

import { useState, useMemo } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

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

// Color palette for the chart
const COLORS = [
  'rgba(239, 68, 68, 0.8)',   // red
  'rgba(34, 197, 94, 0.8)',   // green
  'rgba(59, 130, 246, 0.8)',  // blue
  'rgba(168, 85, 247, 0.8)',  // purple
  'rgba(249, 115, 22, 0.8)',  // orange
  'rgba(236, 72, 153, 0.8)',  // pink
  'rgba(20, 184, 166, 0.8)',  // teal
  'rgba(234, 179, 8, 0.8)',   // yellow
]

const BORDER_COLORS = [
  'rgba(239, 68, 68, 1)',
  'rgba(34, 197, 94, 1)',
  'rgba(59, 130, 246, 1)',
  'rgba(168, 85, 247, 1)',
  'rgba(249, 115, 22, 1)',
  'rgba(236, 72, 153, 1)',
  'rgba(20, 184, 166, 1)',
  'rgba(234, 179, 8, 1)',
]

export function GroupDebtChart({ members, debts, currentUserId }: GroupDebtChartProps) {
  // Selected member IDs for filtering
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => {
    return new Set(members.map(m => m.user.id))
  })

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

  // Calculate net balances between selected members
  const balances = useMemo(() => {
    // Only consider pending debts involving selected members
    const relevantDebts = debts.filter(
      d => d.status === 'pending' &&
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
  }, [debts, selectedMemberIds])

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
        <CardDescription>Who owes who in this group (pending debts only)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Member filter */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Filter by members</span>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Select all
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={selectNone}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
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
                    'rounded-full px-3 py-1 text-sm font-medium transition-colors',
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
              <span className="font-medium">Total outstanding</span>
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
            No pending debts between selected members.
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
