"use client"

import { MoreHorizontal, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { UserCard } from "./user-card"
import type { FriendWithUser } from "./types"

interface BestiesListProps {
  friends: FriendWithUser[]
}

export function BestiesList({ friends }: BestiesListProps) {
  if (friends.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[13px] text-muted-foreground">No besties yet. Add some friends!</p>
      </div>
    )
  }

  return (
    <div className="space-y-0">
      {friends.map((friendship, idx) => {
        const user = friendship.friend
        const initials = user.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)

        return (
          <BestieRow
            key={friendship.id}
            name={user.name}
            email={user.email}
            initials={initials}
            updatedAt={friendship.updatedAt}
            isLast={idx === friends.length - 1}
          />
        )
      })}
    </div>
  )
}

interface BestieRowProps {
  name: string
  email: string
  initials: string
  updatedAt: Date
  isLast: boolean
}

function BestieRow({ name, email, initials, updatedAt, isLast }: BestieRowProps) {
  const lastActivity = formatLastActivity(updatedAt)

  return (
    <>
      <div className="flex items-center gap-3 py-[10px] group">
        <UserCard
          name={name}
          handle={email}
          initials={initials}
        >
          <p className="text-[11px] text-muted-foreground/50 truncate mt-[3px]">
            {lastActivity}
          </p>
        </UserCard>

        <BestieActions />
      </div>
      {!isLast && <Separator className="bg-border" />}
    </>
  )
}

function BestieActions() {
  return (
    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary"
      >
        <MessageCircle className="h-3.5 w-3.5" />
        <span className="sr-only">Message</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-secondary"
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
        <span className="sr-only">More options</span>
      </Button>
    </div>
  )
}

function formatLastActivity(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  const weeks = Math.floor(diff / 604800000)

  if (minutes < 5) return "Active now"
  if (hours < 1) return `Active ${minutes}m ago`
  if (days < 1) return `Active ${hours}h ago`
  if (weeks < 1) return `Active ${days}d ago`
  return `Active ${weeks}w ago`
}
