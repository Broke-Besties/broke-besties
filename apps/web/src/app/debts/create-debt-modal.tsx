'use client'

import { useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { createStandaloneDebt, searchFriendsForDebt, getRecentFriendsForDebt, getUserGroups } from './actions'

type Friend = {
  id: string
  name: string
  email: string
}

type Group = {
  id: number
  name: string
}

type CreateDebtModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  currentUserId: string
}

export function CreateDebtModal({ isOpen, onClose, onSuccess, currentUserId }: CreateDebtModalProps) {
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [borrower, setBorrower] = useState<Friend | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [groups, setGroups] = useState<Group[]>([])

  // Alert fields
  const [alertMessage, setAlertMessage] = useState('')
  const [alertDeadline, setAlertDeadline] = useState('')

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Friend[]>([])
  const [recentFriends, setRecentFriends] = useState<Friend[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Load recent friends and groups when modal opens
  useEffect(() => {
    if (isOpen) {
      getRecentFriendsForDebt().then(result => {
        if (result.success) {
          setRecentFriends(result.friends.filter(f => f.id !== currentUserId))
        }
      })
      getUserGroups().then(result => {
        if (result.success) {
          setGroups(result.groups)
        }
      })
    }
  }, [isOpen, currentUserId])

  // Debounced search for friends
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setSearching(true)
      try {
        const result = await searchFriendsForDebt(searchQuery)
        if (result.success) {
          const filtered = result.friends.filter(f => f.id !== currentUserId)
          setSearchResults(filtered)
        }
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, currentUserId])

  const handleSubmit = async () => {
    if (!borrower || !amount || parseFloat(amount) <= 0) {
      setError('Please select a borrower and enter a valid amount')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const result = await createStandaloneDebt({
        amount: parseFloat(amount),
        description: description || undefined,
        borrowerId: borrower.id,
        groupId: selectedGroupId && selectedGroupId !== 'none' ? parseInt(selectedGroupId) : undefined,
      })

      if (result.success && result.debt) {
        // If alert fields are provided, create an alert for this debt
        if (alertMessage || alertDeadline) {
          try {
            await fetch('/api/alerts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                debtId: result.debt.id,
                message: alertMessage || null,
                deadline: alertDeadline || null,
              }),
            })
          } catch (alertError) {
            console.error('Failed to create alert:', alertError)
            // Don't fail the whole operation if alert creation fails
          }
        }
        onSuccess()
        handleClose()
      } else {
        setError(result.error || 'Failed to create debt')
      }
    } catch {
      setError('An error occurred while creating the debt')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setAmount('')
    setDescription('')
    setBorrower(null)
    setSelectedGroupId('')
    setAlertMessage('')
    setAlertDeadline('')
    setSearchQuery('')
    setSearchResults([])
    setError('')
    onClose()
  }

  const selectBorrower = (friend: Friend) => {
    setBorrower(friend)
    setSearchQuery('')
    setSearchResults([])
  }

  if (!isOpen) return null

  const displayResults = searchQuery.trim() ? searchResults : recentFriends
  const showDropdown = searchQuery.trim() || (!borrower && recentFriends.length > 0)

  return (
    <div className="fixed inset-0 z-50">
      <DialogOverlay onClick={handleClose} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Debt</DialogTitle>
          <DialogDescription>
            Create a debt with a friend. They will owe you this amount.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-4 space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Friend Search */}
          <div className="space-y-2">
            <Label htmlFor="friendSearch">Who owes you?</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="friendSearch"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friends by name or email..."
                className="pl-9"
                autoComplete="off"
              />
            </div>

            {showDropdown && (
              <div className="max-h-40 overflow-y-auto rounded-lg border bg-background shadow-sm">
                {searching ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
                ) : displayResults.length > 0 ? (
                  <>
                    {!searchQuery.trim() && (
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b">
                        Recent friends
                      </div>
                    )}
                    {displayResults.map((friend) => (
                      <button
                        key={friend.id}
                        type="button"
                        onClick={() => selectBorrower(friend)}
                        className="w-full border-b p-3 text-left hover:bg-muted/50 transition-colors last:border-b-0"
                      >
                        <div className="font-medium text-sm">{friend.name}</div>
                        <div className="text-xs text-muted-foreground">{friend.email}</div>
                      </button>
                    ))}
                  </>
                ) : searchQuery.trim() ? (
                  <div className="p-3 text-center text-sm text-muted-foreground">No friends found</div>
                ) : null}
              </div>
            )}
          </div>

          {/* Selected Borrower */}
          {borrower && (
            <div className="space-y-2">
              <Label>Selected Person</Label>
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{borrower.name}</div>
                    <div className="text-xs text-muted-foreground">{borrower.email}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBorrower(null)}
                    className="p-1 rounded hover:bg-background transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => {
                const value = e.target.value
                if (value && !isNaN(parseFloat(value))) {
                  const rounded = Math.round(parseFloat(value) * 100) / 100
                  setAmount(rounded.toString())
                } else {
                  setAmount(value)
                }
              }}
              placeholder="0.00"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this debt for?"
              className="resize-none"
            />
          </div>

          {/* Group Selector */}
          <div className="space-y-2">
            <Label htmlFor="group">Group (optional)</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger id="group">
                <SelectValue placeholder="Select a group (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Associate this debt with a group, or leave empty for a personal debt
            </p>
          </div>

          {/* Alert Section */}
          <div className="space-y-4 pt-4 border-t">
            <Label className="text-base font-medium">Payment Reminder (optional)</Label>
            <div className="space-y-2">
              <Label htmlFor="alertMessage" className="text-sm">Message</Label>
              <Textarea
                id="alertMessage"
                value={alertMessage}
                onChange={(e) => setAlertMessage(e.target.value)}
                rows={2}
                placeholder="e.g., Please pay by end of month"
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alertDeadline" className="text-sm">Deadline</Label>
              <Input
                id="alertDeadline"
                type="date"
                value={alertDeadline}
                onChange={(e) => setAlertDeadline(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !borrower || !amount}>
            {submitting ? 'Creating...' : 'Create Debt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </div>
  )
}
