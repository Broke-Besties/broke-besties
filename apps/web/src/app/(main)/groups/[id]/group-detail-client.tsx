"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { ArrowLeft } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createInvite,
  createDebt,
  updateDebtStatus,
  getRecentFriends,
  searchFriendsForInvite,
  addFriendToGroup,
  cancelInvite,
} from "./actions"
import { GroupDebtsList } from "./group-debts-list"
import { GroupSummary } from "./group-summary"

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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export default function GroupDetailPageClient({
  initialGroup,
  initialDebts,
  currentUser,
  groupId,
}: GroupDetailPageClientProps) {
  const [group] = useState<Group>(initialGroup)
  const [debts, setDebts] = useState<Debt[]>(initialDebts)
  const [error, setError] = useState("")
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showDebtModal, setShowDebtModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  // Invite state
  const [inviteInput, setInviteInput] = useState("")
  const [inviting, setInviting] = useState(false)
  const [recentFriends, setRecentFriends] = useState<
    Array<{ id: number; userId: string; name: string; email: string }>
  >([])
  const [searchResults, setSearchResults] = useState<
    Array<{ id: number; userId: string; name: string; email: string }>
  >([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [searchingFriends, setSearchingFriends] = useState(false)
  const [cancellingInviteId, setCancellingInviteId] = useState<number | null>(null)

  // Simple debt form state
  const [debtBorrowerId, setDebtBorrowerId] = useState("")
  const [debtAmount, setDebtAmount] = useState("")
  const [debtDescription, setDebtDescription] = useState("")

  // Sync debts with server
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
    if (!inviteInput.trim()) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(() => {
      setSearchingFriends(true)
      searchFriendsForInvite(groupId, inviteInput)
        .then((result) => {
          if (result.success) {
            setSearchResults(result.friends)
          }
        })
        .finally(() => setSearchingFriends(false))
    }, 300)

    return () => clearTimeout(timer)
  }, [inviteInput, groupId])

  const handleAddFriend = async (friendUserId: string) => {
    setInviting(true)
    setError("")
    try {
      const result = await addFriendToGroup(groupId, friendUserId)
      if (!result.success) {
        setError(result.error || "Failed to add friend")
        return
      }
      setShowInviteModal(false)
      setInviteInput("")
      router.refresh()
    } catch {
      setError("Failed to add friend to group")
    } finally {
      setInviting(false)
    }
  }

  const handleInviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteInput.includes("@")) return
    setInviting(true)
    setError("")
    try {
      const result = await createInvite(groupId, inviteInput)
      if (!result.success) {
        setError(result.error || "Failed to send invite")
        return
      }
      setShowInviteModal(false)
      setInviteInput("")
      router.refresh()
    } catch {
      setError("Failed to send invite")
    } finally {
      setInviting(false)
    }
  }

  const handleCancelInvite = async (inviteId: number) => {
    setCancellingInviteId(inviteId)
    try {
      const result = await cancelInvite(groupId, inviteId)
      if (!result.success) {
        setError(result.error || "Failed to cancel invite")
        return
      }
      router.refresh()
    } catch {
      setError("Failed to cancel invite")
    } finally {
      setCancellingInviteId(null)
    }
  }

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!debtBorrowerId || !debtAmount) return
    setCreating(true)
    setError("")
    try {
      const result = await createDebt({
        amount: parseFloat(debtAmount),
        description: debtDescription || undefined,
        borrowerId: debtBorrowerId,
        groupId,
      })
      if (!result.success) {
        setError(result.error || "Failed to create debt")
        return
      }
      setShowDebtModal(false)
      setDebtBorrowerId("")
      setDebtAmount("")
      setDebtDescription("")
      router.refresh()
    } catch {
      setError("Failed to create debt")
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateStatus = async (debtId: number, newStatus: string) => {
    const oldStatus = debts.find((d) => d.id === debtId)?.status
    setDebts((prev) =>
      prev.map((d) => (d.id === debtId ? { ...d, status: newStatus } : d))
    )
    try {
      const result = await updateDebtStatus(debtId, newStatus)
      if (!result.success) {
        setError(result.error || "Failed to update status")
        if (oldStatus) {
          setDebts((prev) =>
            prev.map((d) => (d.id === debtId ? { ...d, status: oldStatus } : d))
          )
        }
      }
    } catch {
      setError("Failed to update status")
      if (oldStatus) {
        setDebts((prev) =>
          prev.map((d) => (d.id === debtId ? { ...d, status: oldStatus } : d))
        )
      }
    }
  }

  // Members who are not the current user (for debt creation dropdown)
  const otherMembers = group.members.filter((m) => m.user.id !== currentUser?.id)

  // Friends to display in invite modal
  const friendsToShow = inviteInput.trim()
    ? searchResults
    : recentFriends
  const isEmailInput = inviteInput.includes("@")

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Back */}
        <button
          onClick={() => router.push("/groups")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit cursor-pointer"
        >
          <ArrowLeft size={14} />
          Back to groups
        </button>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">
              {group.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {group.members.length} {group.members.length === 1 ? "member" : "members"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-sm h-9"
              onClick={() => setShowInviteModal(true)}
            >
              Invite
            </Button>
            <Button
              size="sm"
              className="text-sm h-9"
              onClick={() => setShowDebtModal(true)}
            >
              Add debt
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="border-t border-border" />

        {/* Main content - single column stacked */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
          {/* Left: Debt Ledger */}
          <GroupDebtsList
            debts={debts}
            currentUser={currentUser}
            onUpdateStatus={handleUpdateStatus}
          />

          {/* Right: Summary + Members */}
          <div className="flex flex-col gap-6">
            <GroupSummary
              members={group.members}
              debts={debts}
              currentUserId={currentUser?.id}
            />

            {/* Members */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Members
              </h3>
              <div className="flex flex-col gap-1">
                {group.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-2.5 py-2 px-2.5 -mx-2.5 rounded-md"
                  >
                    <Avatar className="h-7 w-7 rounded-full border border-border">
                      <AvatarFallback className="bg-muted text-foreground rounded-full text-[10px] font-semibold">
                        {getInitials(member.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {member.user.name}
                        {member.user.id === currentUser?.id && (
                          <span className="text-muted-foreground"> (you)</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Pending invites inline */}
                {group.invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between py-2 px-2.5 -mx-2.5 rounded-md"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-full border border-dashed border-border flex items-center justify-center">
                        <span className="text-[10px] text-muted-foreground">?</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground truncate">
                          {invite.invitedEmail}
                        </p>
                        <p className="text-xs text-muted-foreground">Pending invite</p>
                      </div>
                    </div>
                    {currentUser?.id === invite.invitedBy && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                        disabled={cancellingInviteId === invite.id}
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        {cancellingInviteId === invite.id ? "..." : "Cancel"}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Invite Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 z-50">
            <DialogOverlay onClick={() => { setShowInviteModal(false); setInviteInput("") }} />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite member</DialogTitle>
                <DialogDescription>
                  Search for a friend or enter an email address.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleInviteByEmail} className="flex flex-col gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Name or email</Label>
                  <Input
                    type="text"
                    value={inviteInput}
                    onChange={(e) => setInviteInput(e.target.value)}
                    placeholder="Search friends or enter email..."
                    className="h-9 text-sm"
                    autoComplete="off"
                  />
                </div>

                {/* Results */}
                <div className="max-h-48 overflow-y-auto">
                  {loadingFriends || searchingFriends ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      {loadingFriends ? "Loading..." : "Searching..."}
                    </p>
                  ) : friendsToShow.length > 0 ? (
                    <div className="flex flex-col">
                      {!inviteInput.trim() && (
                        <p className="text-xs text-muted-foreground mb-2">Recent friends</p>
                      )}
                      {friendsToShow.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center justify-between py-2 px-2.5 -mx-2.5 rounded-md hover:bg-muted transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate">{friend.name}</p>
                            <p className="text-xs text-muted-foreground">{friend.email}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 px-2.5 text-xs"
                            disabled={inviting}
                            onClick={() => handleAddFriend(friend.userId)}
                          >
                            Add
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : inviteInput.trim() && !isEmailInput ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No friends found. Enter a full email to invite.
                    </p>
                  ) : null}
                </div>

                <DialogFooter className="pt-1 gap-2 flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-sm"
                    onClick={() => { setShowInviteModal(false); setInviteInput("") }}
                  >
                    Cancel
                  </Button>
                  {isEmailInput && (
                    <Button type="submit" size="sm" className="text-sm flex-1" disabled={inviting}>
                      {inviting ? "Sending..." : "Send invite"}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </DialogContent>
          </div>
        )}

        {/* Add Debt Modal */}
        {showDebtModal && (
          <div className="fixed inset-0 z-50">
            <DialogOverlay onClick={() => { setShowDebtModal(false); setError("") }} />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add debt</DialogTitle>
                <DialogDescription>
                  Create a debt with a group member.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateDebt} className="flex flex-col gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Who owes you</Label>
                  <Select value={debtBorrowerId} onValueChange={setDebtBorrowerId}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherMembers.map((m) => (
                        <SelectItem key={m.user.id} value={m.user.id} className="text-sm cursor-pointer">
                          {m.user.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={debtAmount}
                      onChange={(e) => setDebtAmount(e.target.value)}
                      className="pl-6 h-9 text-sm tabular-nums"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Description</Label>
                  <Input
                    type="text"
                    placeholder="e.g. Dinner, Uber, Groceries..."
                    value={debtDescription}
                    onChange={(e) => setDebtDescription(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>

                <DialogFooter className="pt-1 gap-2 flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-sm"
                    onClick={() => { setShowDebtModal(false); setDebtBorrowerId(""); setDebtAmount(""); setDebtDescription(""); setError("") }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="text-sm flex-1"
                    disabled={creating || !debtBorrowerId || !debtAmount}
                  >
                    {creating ? "Adding..." : "Add debt"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </div>
        )}
      </div>
    </main>
  )
}
