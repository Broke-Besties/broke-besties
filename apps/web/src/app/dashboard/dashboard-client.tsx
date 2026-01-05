'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { updateDebtStatus, updateTabStatus } from './actions'

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

type User = {
  id: string
  email: string
}

type Group = {
  id: number
  name: string
  createdAt: Date | string
  _count: {
    members: number
  }
}

type Tab = {
  id: number
  amount: number
  description: string
  personName: string
  status: string
  createdAt: Date | string
}

type DashboardPageClientProps = {
  initialDebts: any[]
  initialGroups: any[]
  initialTabs: any[]
  currentUser: any
}

export default function DashboardPageClient({
  initialDebts,
  initialGroups,
  initialTabs,
  currentUser,
}: DashboardPageClientProps) {
  const [debts, setDebts] = useState<Debt[]>(initialDebts)
  const [groups] = useState<Group[]>(initialGroups)
  const [tabs, setTabs] = useState<Tab[]>(initialTabs)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleUpdateStatus = async (debtId: number, newStatus: string) => {
    // Store the old status in case we need to revert
    const oldStatus = debts.find(d => d.id === debtId)?.status

    // Optimistically update the UI
    setDebts(prevDebts =>
      prevDebts.map(debt =>
        debt.id === debtId ? { ...debt, status: newStatus } : debt
      )
    )

    try {
      const result = await updateDebtStatus(debtId, newStatus)

      if (!result.success) {
        setError(result.error || 'Failed to update status')
        // Revert to old status
        if (oldStatus) {
          setDebts(prevDebts =>
            prevDebts.map(debt =>
              debt.id === debtId ? { ...debt, status: oldStatus } : debt
            )
          )
        }
        return
      }
    } catch (err) {
      setError('An error occurred while updating the status')
      // Revert to old status
      if (oldStatus) {
        setDebts(prevDebts =>
          prevDebts.map(debt =>
            debt.id === debtId ? { ...debt, status: oldStatus } : debt
          )
        )
      }
    }
  }

  const handleUpdateTabStatus = async (tabId: number, newStatus: string) => {
    const oldStatus = tabs.find(t => t.id === tabId)?.status

    // Optimistically update the UI
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, status: newStatus } : tab
      )
    )

    try {
      const result = await updateTabStatus(tabId, newStatus)

      if (!result.success) {
        setError(result.error || 'Failed to update tab status')
        if (oldStatus) {
          setTabs(prevTabs =>
            prevTabs.map(tab =>
              tab.id === tabId ? { ...tab, status: oldStatus } : tab
            )
          )
        }
        return
      }
    } catch (err) {
      setError('An error occurred while updating the tab status')
      if (oldStatus) {
        setTabs(prevTabs =>
          prevTabs.map(tab =>
            tab.id === tabId ? { ...tab, status: oldStatus } : tab
          )
        )
      }
    }
  }

  const lendingDebts = debts.filter((debt) => debt.lender.id === currentUser?.id)
  const borrowingDebts = debts.filter((debt) => debt.borrower.id === currentUser?.id)
  const pendingTabs = tabs.filter((tab) => tab.status === 'pending')

  const calculateTotal = (debtList: Debt[]) => {
    return debtList.reduce((sum, debt) => sum + debt.amount, 0)
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Manage your debts and loans.</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>You are lending</CardTitle>
              <CardDescription>Money owed to you</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tracking-tight text-foreground">
                ${calculateTotal(lendingDebts).toFixed(2)}
              </div>
              <Badge className="mt-2" variant="secondary">
                {lendingDebts.length} item{lendingDebts.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {lendingDebts.length === 0 ? (
              <div className="rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                No lending records.
              </div>
            ) : (
              lendingDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="cursor-pointer rounded-lg border bg-background p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => router.push(`/debts/${debt.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{debt.borrower.email}</div>
                      {debt.description && <div className="mt-0.5 text-sm text-muted-foreground">{debt.description}</div>}
                      {debt.group && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Group: <span className="font-medium text-foreground">{debt.group.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold">${debt.amount.toFixed(2)}</div>
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
                        debt.status === 'not_paying' && 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                      )}
                    >
                      {debt.status === 'not_paying' ? 'Not paying' : debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
                    </Badge>

                    <select
                      value={debt.status}
                      onChange={(e) => handleUpdateStatus(debt.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="not_paying">Not Paying</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>You are borrowing</CardTitle>
              <CardDescription>Money you owe</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tracking-tight text-foreground">
                ${calculateTotal(borrowingDebts).toFixed(2)}
              </div>
              <Badge className="mt-2" variant="secondary">
                {borrowingDebts.length} item{borrowingDebts.length === 1 ? '' : 's'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {borrowingDebts.length === 0 ? (
              <div className="rounded-md border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
                No borrowing records.
              </div>
            ) : (
              borrowingDebts.map((debt) => (
                <div
                  key={debt.id}
                  className="cursor-pointer rounded-lg border bg-background p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  onClick={() => router.push(`/debts/${debt.id}`)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{debt.lender.email}</div>
                      {debt.description && <div className="mt-0.5 text-sm text-muted-foreground">{debt.description}</div>}
                      {debt.group && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          Group: <span className="font-medium text-foreground">{debt.group.name}</span>
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold">${debt.amount.toFixed(2)}</div>
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
                        debt.status === 'not_paying' && 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
                      )}
                    >
                      {debt.status === 'not_paying' ? 'Not paying' : debt.status.charAt(0).toUpperCase() + debt.status.slice(1)}
                    </Badge>

                    <select
                      value={debt.status}
                      onChange={(e) => handleUpdateStatus(debt.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-9 rounded-md border bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                      <option value="not_paying">Not Paying</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Your Tabs</h2>
            <p className="text-sm text-muted-foreground">Money you owe outside the platform</p>
          </div>
          <Button onClick={() => router.push('/tabs')}>
            View all
          </Button>
        </div>

        {pendingTabs.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No tabs yet</CardTitle>
              <CardDescription>
                Track what you owe to people outside the platform.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/tabs')}>
                Add a tab
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pendingTabs.map((tab) => (
              <Card key={tab.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{tab.personName}</CardTitle>
                    <Badge variant="secondary">Pending</Badge>
                  </div>
                  <CardDescription className="text-xl font-semibold text-foreground">
                    ${tab.amount.toFixed(2)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{tab.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {new Date(tab.createdAt).toLocaleDateString()}
                  </p>
                  <Button
                    size="sm"
                    onClick={() => handleUpdateTabStatus(tab.id, 'paid')}
                  >
                    Mark Paid
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Your Groups</h2>
            <p className="text-sm text-muted-foreground">Groups you're a member of</p>
          </div>
          <Button onClick={() => router.push('/groups')}>
            View all
          </Button>
        </div>

        {groups.length === 0 ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No groups yet</CardTitle>
              <CardDescription>
                You haven&apos;t joined any groups. Create one to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/groups')}>
                Go to groups
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <Card
                key={group.id}
                className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
                onClick={() => router.push(`/groups/${group.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                  <CardDescription>
                    {group._count.members}{" "}
                    {group._count.members === 1 ? "member" : "members"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  Created {new Date(group.createdAt).toLocaleDateString()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
