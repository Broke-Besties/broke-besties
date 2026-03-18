"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createGroup } from "@/app/(main)/groups/actions"

type Group = {
  id: number
  name: string
  createdAt: Date | string
  _count: {
    members: number
  }
}

type GroupsPageClientProps = {
  initialGroups: any[]
}

export default function GroupsPageClient({ initialGroups }: GroupsPageClientProps) {
  const [groups] = useState<Group[]>(initialGroups)
  const [error, setError] = useState("")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [creating, setCreating] = useState(false)
  const router = useRouter()

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError("")

    try {
      const result = await createGroup(newGroupName)

      if (!result.success) {
        setError(result.error || "Failed to create group")
        return
      }

      setShowCreateModal(false)
      setNewGroupName("")
      router.refresh()
    } catch {
      setError("An error occurred while creating the group")
    } finally {
      setCreating(false)
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Groups</h1>
          <Button size="sm" className="text-sm h-9" onClick={() => setShowCreateModal(true)}>
            Create group
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Group list */}
        {groups.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              You haven&apos;t joined any groups yet.
            </p>
            <Button size="sm" onClick={() => setShowCreateModal(true)}>
              Create your first group
            </Button>
          </div>
        ) : (
          <div className="flex flex-col">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="flex items-center justify-between py-3.5 px-1 border-b border-border/50 last:border-b-0 hover:bg-muted/50 -mx-1 px-3 rounded-md transition-colors cursor-pointer"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-sm font-medium text-foreground truncate">
                    {group.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {group._count.members} {group._count.members === 1 ? "member" : "members"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-4">
                  {new Date(group.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </Link>
            ))}
          </div>
        )}

        {/* Create group modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50">
            <DialogOverlay onClick={() => { setShowCreateModal(false); setNewGroupName(""); setError("") }} />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create group</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateGroup} className="flex flex-col gap-4 pt-1">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-sm">Group name</Label>
                  <Input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Roommates"
                    className="h-9 text-sm"
                  />
                </div>
                <DialogFooter className="pt-1 gap-2 flex-row">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-sm"
                    onClick={() => { setShowCreateModal(false); setNewGroupName(""); setError("") }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" className="text-sm flex-1" disabled={creating}>
                    {creating ? "Creating..." : "Create group"}
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
