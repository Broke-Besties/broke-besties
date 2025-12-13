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
import { createInvite } from '@/actions/invite.actions'
import { createDebt, updateDebtStatus } from '@/actions/debt.actions'
import { searchUserByEmail } from '@/actions/user.actions'

type Member = {
  id: number
  user: {
    id: string
    email: string
  }
}

type Invite = {
  id: number
  invitedEmail: string
  status: string
  sender: {
    email: string
  }
}

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
}

type Group = {
  id: number
  name: string
  createdAt: Date | string
  members: Member[]
  invites: Invite[]
}

type User = {
  id: string
  email: string
}

type GroupDetailPageClientProps = {
  initialGroup: any
  initialDebts: any[]
  currentUser: any
  groupId: number
}

export default function GroupDetailPageClient({
  initialGroup,
  initialDebts,
  currentUser,
  groupId,
}: GroupDetailPageClientProps) {
  const [group] = useState<Group>(initialGroup)
  const [debts] = useState<Debt[]>(initialDebts)
  const [error, setError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showDebtModal, setShowDebtModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [debtFormData, setDebtFormData] = useState({
    amount: '',
    description: '',
    borrowerEmail: '',
  })
  const router = useRouter()

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setError('')

    try {
      const result = await createInvite(groupId, inviteEmail)

      if (!result.success) {
        setError(result.error || 'Failed to send invite')
        return
      }

      setShowInviteModal(false)
      setInviteEmail('')
      router.refresh()
    } catch (err) {
      setError('An error occurred while sending the invite')
    } finally {
      setInviting(false)
    }
  }

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      // First, find the user by email
      const userResult = await searchUserByEmail(debtFormData.borrowerEmail)

      if (!userResult.success) {
        setError(userResult.error || 'User not found')
        setCreating(false)
        return
      }

      const result = await createDebt({
        amount: parseFloat(debtFormData.amount),
        description: debtFormData.description || undefined,
        borrowerId: userResult.user.id,
        groupId,
      })

      if (!result.success) {
        setError(result.error || 'Failed to create debt')
        return
      }

      setShowDebtModal(false)
      setDebtFormData({ amount: '', description: '', borrowerEmail: '' })
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4">
        <Button variant="ghost" className="w-fit px-0" onClick={() => router.push('/groups')}>
          ← Back to groups
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight">{group.name}</h1>
            <p className="text-sm text-muted-foreground">
              Created {new Date(group.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowDebtModal(true)}>
              Create debt
            </Button>
            <Button onClick={() => setShowInviteModal(true)}>
              Invite member
            </Button>
          </div>
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
              <CardTitle>Members</CardTitle>
              <CardDescription>{group.members.length} total</CardDescription>
            </div>
            <Badge variant="secondary">{group.members.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.members.map((member) => (
              <div key={member.id} className="flex items-center justify-between rounded-md border bg-background p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{member.user.email}</div>
                  <div className="text-xs text-muted-foreground">Member</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle>Pending invites</CardTitle>
              <CardDescription>{group.invites.length} outstanding</CardDescription>
            </div>
            <Badge variant="secondary">{group.invites.length}</Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {group.invites.length === 0 ? (
              <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                No pending invites.
              </div>
            ) : (
              group.invites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between rounded-md border bg-background p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{invite.invitedEmail}</div>
                    <div className="text-xs text-muted-foreground">Invited by {invite.sender.email}</div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                  >
                    Pending
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle>Group debts</CardTitle>
            <CardDescription>{debts.length} total</CardDescription>
          </div>
          <Badge variant="secondary">{debts.length}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          {debts.length === 0 ? (
            <div className="rounded-md border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
              No debts in this group yet.
            </div>
          ) : (
            debts.map((debt) => {
              const isLender = currentUser?.id === debt.lender.id
              return (
                <div key={debt.id} className="rounded-lg border bg-background p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="font-medium">
                        {isLender ? (
                          <span>
                            <span className="text-emerald-600 dark:text-emerald-400">You lent to</span> {debt.borrower.email}
                          </span>
                        ) : (
                          <span>
                            <span className="text-rose-600 dark:text-rose-400">You borrowed from</span> {debt.lender.email}
                          </span>
                        )}
                      </div>
                      {debt.description && <div className="text-sm text-muted-foreground">{debt.description}</div>}
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
              )
            })
          )}
        </CardContent>
      </Card>

      {showInviteModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <form onSubmit={handleInvite} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="inviteEmail">Email address</Label>
                  <Input
                    id="inviteEmail"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="member@example.com"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowInviteModal(false)
                      setInviteEmail('')
                      setError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviting}>
                    {inviting ? 'Sending…' : 'Send invite'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        </div>
      )}

      {showDebtModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new debt</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <form onSubmit={handleCreateDebt} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="borrowerEmail">Borrower email (must be a group member)</Label>
                  <Input
                    id="borrowerEmail"
                    type="email"
                    required
                    value={debtFormData.borrowerEmail}
                    onChange={(e) => setDebtFormData({ ...debtFormData, borrowerEmail: e.target.value })}
                    placeholder="borrower@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="debtAmount">Amount ($)</Label>
                  <Input
                    id="debtAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={debtFormData.amount}
                    onChange={(e) => setDebtFormData({ ...debtFormData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="debtDescription">Description (optional)</Label>
                  <Textarea
                    id="debtDescription"
                    value={debtFormData.description}
                    onChange={(e) => setDebtFormData({ ...debtFormData, description: e.target.value })}
                    rows={3}
                    placeholder="What is this debt for?"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowDebtModal(false)
                      setDebtFormData({ amount: '', description: '', borrowerEmail: '' })
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
