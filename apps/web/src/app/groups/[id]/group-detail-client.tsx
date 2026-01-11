'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import type { User } from '@supabase/supabase-js'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DialogContent, DialogFooter, DialogHeader, DialogOverlay, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createInvite, createDebt, createDebts, updateDebtStatus, getRecentFriends, searchFriendsForInvite, addFriendToGroup, cancelInvite } from './actions'
import { DebtFormItem } from './debt-form-item'
import { GroupDebtsList } from './group-debts-list'
import { GroupDebtChart } from './group-debt-chart'

type Member = {
  id: number
  user: {
    id: string
    name: string
    email: string
  }
}

type Invite = {
  id: number
  invitedEmail: string
  invitedBy: string
  status: string
  sender: {
    id: string
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
    name: string
    email: string
  }
  borrower: {
    id: string
    name: string
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

type GroupDetailPageClientProps = {
  initialGroup: Group
  initialDebts: Debt[]
  currentUser: User | null
  groupId: number
}

export default function GroupDetailPageClient({
  initialGroup,
  initialDebts,
  currentUser,
  groupId,
}: GroupDetailPageClientProps) {
  const [group] = useState<Group>(initialGroup)
  const [debts, setDebts] = useState<Debt[]>(initialDebts)
  const [error, setError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showDebtModal, setShowDebtModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  
  // Friend invite state
  const [inviteTab, setInviteTab] = useState<'friends' | 'email'>('friends')
  const [friendSearch, setFriendSearch] = useState('')
  const [recentFriends, setRecentFriends] = useState<Array<{ id: number; userId: string; name: string; email: string }>>([])
  const [searchResults, setSearchResults] = useState<Array<{ id: number; userId: string; name: string; email: string }>>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [searchingFriends, setSearchingFriends] = useState(false)
  const [cancellingInviteId, setCancellingInviteId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [debtForms, setDebtForms] = useState([{
    amount: '',
    description: '',
    borrowerId: '',
    borrower: null as { id: string; name: string; email: string } | null,
  }])
  const [currentDebtIndex, setCurrentDebtIndex] = useState(0)
  const router = useRouter()

  // Sync debts state with initialDebts when it changes (after refresh)
  useEffect(() => {
    setDebts(initialDebts)
  }, [initialDebts])

  // Load recent friends when invite modal opens
  useEffect(() => {
    if (showInviteModal) {
      setLoadingFriends(true)
      getRecentFriends(groupId)
        .then((result) => {
          if (result.success) {
            setRecentFriends(result.friends)
          }
        })
        .finally(() => setLoadingFriends(false))
    }
  }, [showInviteModal, groupId])

  // Search friends with debounce
  useEffect(() => {
    if (!friendSearch.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(() => {
      setSearchingFriends(true)
      searchFriendsForInvite(groupId, friendSearch)
        .then((result) => {
          if (result.success) {
            setSearchResults(result.friends)
          }
        })
        .finally(() => setSearchingFriends(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [friendSearch, groupId])

  const handleAddFriend = async (friendUserId: string) => {
    setInviting(true)
    setError('')

    try {
      const result = await addFriendToGroup(groupId, friendUserId)

      if (!result.success) {
        setError(result.error || 'Failed to add friend to group')
        return
      }

      setShowInviteModal(false)
      setFriendSearch('')
      setInviteTab('friends')
      router.refresh()
    } catch {
      setError('An error occurred while adding friend to group')
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvite = async (inviteId: number) => {
    setCancellingInviteId(inviteId)
    setError('')

    try {
      const result = await cancelInvite(groupId, inviteId)

      if (!result.success) {
        setError(result.error || 'Failed to cancel invite')
        return
      }

      router.refresh()
    } catch {
      setError('An error occurred while cancelling the invite')
    } finally {
      setCancellingInviteId(null)
    }
  }

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
    } catch {
      setError('An error occurred while sending the invite')
    } finally {
      setInviting(false)
    }
  }

  const handleCreateDebts = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      // Validate all debts have required fields
      for (let i = 0; i < debtForms.length; i++) {
        const debt = debtForms[i]
        if (!debt.borrowerId) {
          setError(`Debt ${i + 1}: Please select a borrower`)
          setCreating(false)
          setCurrentDebtIndex(i)
          return
        }
        if (!debt.amount || parseFloat(debt.amount) <= 0) {
          setError(`Debt ${i + 1}: Please enter a valid amount`)
          setCreating(false)
          setCurrentDebtIndex(i)
          return
        }
      }

      // Prepare data for all debts
      const debtsToCreate = debtForms.map(debt => ({
        amount: parseFloat(debt.amount),
        description: debt.description || undefined,
        borrowerId: debt.borrowerId,
        groupId,
      }))

      // Use single or batch create based on number of debts
      const result = debtsToCreate.length === 1
        ? await createDebt(debtsToCreate[0])
        : await createDebts(debtsToCreate)

      if (!result.success) {
        setError(result.error || 'Failed to create debt(s)')
        setCreating(false)
        return
      }

      // Reset form and refresh
      setShowDebtModal(false)
      setDebtForms([{
        amount: '',
        description: '',
        borrowerId: '',
        borrower: null,
      }])
      setCurrentDebtIndex(0)
      setCreating(false)

      // Refresh the page to show new debts
      router.refresh()
    } catch {
      setError('An error occurred while creating the debt(s)')
      setCreating(false)
    }
  }

  const addNewDebt = () => {
    setDebtForms([...debtForms, {
      amount: '',
      description: '',
      borrowerId: '',
      borrower: null,
    }])
    setCurrentDebtIndex(debtForms.length)
  }

  const removeDebt = (index: number) => {
    if (debtForms.length === 1) return
    const newDebts = debtForms.filter((_, i) => i !== index)
    setDebtForms(newDebts)
    if (currentDebtIndex >= newDebts.length) {
      setCurrentDebtIndex(newDebts.length - 1)
    }
  }

  const updateDebtForm = (index: number, data: typeof debtForms[0]) => {
    const newDebts = [...debtForms]
    newDebts[index] = data
    setDebtForms(newDebts)
  }

  const currentDebt = debtForms[currentDebtIndex]

  // Check if all debts are valid
  const allDebtsValid = debtForms.every(debt =>
    debt.borrowerId && debt.amount && parseFloat(debt.amount) > 0
  )

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
    } catch {
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
              Create debts
            </Button>
            <Button variant="secondary" onClick={() => router.push(`/ai?group=${groupId}`)}>
              <Sparkles className="h-4 w-4" />
              Create with AI
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
                  <div className="truncate font-medium">{member.user.name}</div>
                  <div className="text-xs text-muted-foreground">{member.user.email}</div>
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
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{invite.invitedEmail}</div>
                    <div className="text-xs text-muted-foreground">Invited by {invite.sender.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300"
                    >
                      Pending
                    </Badge>
                    {currentUser?.id === invite.invitedBy && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={cancellingInviteId === invite.id}
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        {cancellingInviteId === invite.id ? 'Cancelling…' : 'Cancel'}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <GroupDebtChart
        members={group.members}
        debts={debts}
        currentUserId={currentUser?.id}
      />

      <GroupDebtsList
        debts={debts}
        currentUser={currentUser}
        onUpdateStatus={handleUpdateStatus}
      />

      {showInviteModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              {/* Tab Switcher */}
              <div className="mb-4 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={inviteTab === 'friends' ? 'default' : 'outline'}
                  onClick={() => setInviteTab('friends')}
                >
                  Friends
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={inviteTab === 'email' ? 'default' : 'outline'}
                  onClick={() => setInviteTab('email')}
                >
                  Email
                </Button>
              </div>

              {/* Friends Tab */}
              {inviteTab === 'friends' && (
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="friendSearch">Search friends</Label>
                    <Input
                      id="friendSearch"
                      type="text"
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                      placeholder="Search by name or email..."
                    />
                  </div>

                  <div className="max-h-64 space-y-2 overflow-y-auto">
                    {loadingFriends ? (
                      <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                        Loading friends...
                      </div>
                    ) : friendSearch.trim() ? (
                      // Show search results
                      searchingFriends ? (
                        <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                          Searching...
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                          No friends found matching your search.
                        </div>
                      ) : (
                        searchResults.map((friend) => (
                          <div
                            key={friend.id}
                            className="flex items-center justify-between rounded-md border bg-background p-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium">{friend.name}</div>
                              <div className="text-xs text-muted-foreground">{friend.email}</div>
                            </div>
                            <Button
                              size="sm"
                              disabled={inviting}
                              onClick={() => handleAddFriend(friend.userId)}
                            >
                              Add
                            </Button>
                          </div>
                        ))
                      )
                    ) : (
                      // Show recent friends
                      recentFriends.length === 0 ? (
                        <div className="rounded-md border bg-muted/40 p-4 text-center text-sm text-muted-foreground">
                          No friends available to add. Add friends or use the Email tab to invite by email.
                        </div>
                      ) : (
                        <>
                          <div className="text-sm font-medium text-muted-foreground">Recent friends</div>
                          {recentFriends.map((friend) => (
                            <div
                              key={friend.id}
                              className="flex items-center justify-between rounded-md border bg-background p-3"
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">{friend.name}</div>
                                <div className="text-xs text-muted-foreground">{friend.email}</div>
                              </div>
                              <Button
                                size="sm"
                                disabled={inviting}
                                onClick={() => handleAddFriend(friend.userId)}
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                        </>
                      )
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setShowInviteModal(false)
                        setFriendSearch('')
                        setInviteTab('friends')
                        setError('')
                      }}
                    >
                      Cancel
                    </Button>
                  </DialogFooter>
                </div>
              )}

              {/* Email Tab */}
              {inviteTab === 'email' && (
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
                        setInviteTab('friends')
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
              )}
            </div>
          </DialogContent>
        </div>
      )}

      {showDebtModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Create new debt{debtForms.length > 1 && ` (${currentDebtIndex + 1} of ${debtForms.length})`}
              </DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <form onSubmit={handleCreateDebts} className="grid gap-4">
                <DebtFormItem
                  debtData={currentDebt}
                  groupId={groupId}
                  currentUserId={currentUser?.id}
                  onChange={(data) => updateDebtForm(currentDebtIndex, data)}
                />

                {debtForms.length > 1 && (
                  <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentDebtIndex(Math.max(0, currentDebtIndex - 1))}
                      disabled={currentDebtIndex === 0}
                    >
                      ← Prev
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Debt {currentDebtIndex + 1} of {debtForms.length}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setCurrentDebtIndex(Math.min(debtForms.length - 1, currentDebtIndex + 1))}
                      disabled={currentDebtIndex === debtForms.length - 1}
                    >
                      Next →
                    </Button>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addNewDebt}
                    className="flex-1"
                  >
                    + Add another debt
                  </Button>
                  {debtForms.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeDebt(currentDebtIndex)}
                    >
                      Remove this debt
                    </Button>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowDebtModal(false)
                      setDebtForms([{
                        amount: '',
                        description: '',
                        borrowerId: '',
                        borrower: null,
                      }])
                      setCurrentDebtIndex(0)
                      setError('')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating || !allDebtsValid}>
                    {creating ? 'Creating…' : `Create ${debtForms.length} debt${debtForms.length > 1 ? 's' : ''}`}
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
