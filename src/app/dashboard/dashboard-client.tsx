'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DialogContent, DialogFooter, DialogHeader, DialogOverlay, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { createDebt, updateDebtStatus } from '@/actions/debt.actions'
import { searchUserByEmail } from '@/actions/user.actions'

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

type DashboardPageClientProps = {
  initialDebts: any[]
  currentUser: any
}

export default function DashboardPageClient({
  initialDebts,
  currentUser,
}: DashboardPageClientProps) {
  const [debts, setDebts] = useState<Debt[]>(initialDebts)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    borrowerEmail: '',
  })
  const router = useRouter()

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      // First, find the user by email
      const userResult = await searchUserByEmail(formData.borrowerEmail)

      if (!userResult.success) {
        setError(userResult.error || 'User not found')
        setCreating(false)
        return
      }

      const result = await createDebt({
        amount: parseFloat(formData.amount),
        description: formData.description || undefined,
        borrowerId: userResult.user.id,
      })

      if (!result.success) {
        setError(result.error || 'Failed to create debt')
        return
      }

      setShowCreateModal(false)
      setFormData({ amount: '', description: '', borrowerEmail: '' })
      router.refresh()
    } catch (err) {
      setError('An error occurred while creating the debt')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateStatus = async (debtId: number, newStatus: string) => {
    try {
      const result = await updateDebtStatus(debtId, newStatus)

      if (!result.success) {
        setError(result.error || 'Failed to update status')
        return
      }

      router.refresh()
    } catch (err) {
      setError('An error occurred while updating the status')
    }
  }

  const lendingDebts = debts.filter((debt) => debt.lender.id === currentUser?.id)
  const borrowingDebts = debts.filter((debt) => debt.borrower.id === currentUser?.id)

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
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => router.push('/groups')}>
            View groups
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>Create debt</Button>
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
                  className="rounded-lg border bg-background p-4 shadow-sm"
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
                  className="rounded-lg border bg-background p-4 shadow-sm"
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

      {showCreateModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new debt</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <form onSubmit={handleCreateDebt} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="borrowerEmail">Borrower email</Label>
                  <Input
                    id="borrowerEmail"
                    type="email"
                    required
                    value={formData.borrowerEmail}
                    onChange={(e) => setFormData({ ...formData, borrowerEmail: e.target.value })}
                    placeholder="borrower@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount ($)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="What is this debt for?"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateModal(false)
                      setFormData({ amount: '', description: '', borrowerEmail: '' })
                      setError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Creating…' : 'Create debt'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        </div>
      )}
    </div>
  )
}
