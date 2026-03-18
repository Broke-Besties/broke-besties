"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import type { FriendDashboardData } from "./types"

interface FriendHeaderProps {
  data: FriendDashboardData
  onSettleUp: () => void
  onAddDebt: () => void
  onNudge: () => void
  onRequest: () => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function FriendHeader({
  data,
  onSettleUp,
  onAddDebt,
}: FriendHeaderProps) {
  const { friend, netBalance, friendsSince } = data
  const isOwed = netBalance > 0
  const isEven = netBalance === 0

  const friendsSinceLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(friendsSince))

  return (
    <div className="flex flex-col gap-5">
      {/* Back */}
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft size={14} />
        Back to friends
      </button>

      {/* Profile + Balance + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Identity */}
        <div className="flex items-center gap-3.5">
          <Avatar className="h-12 w-12 rounded-full border border-border">
            <AvatarFallback className="bg-muted text-foreground rounded-full text-sm font-semibold">
              {getInitials(friend.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-lg font-semibold text-foreground leading-tight">
              {friend.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Friends since {friendsSinceLabel}
            </p>
          </div>
        </div>

        {/* Right: Balance + Actions */}
        <div className="flex items-center gap-4">
          {/* Net balance */}
          <div className="text-right">
            <p className="text-xs text-muted-foreground">
              {isEven ? "All settled" : isOwed ? "They owe you" : "You owe them"}
            </p>
            <p
              className={
                "text-2xl font-bold tabular-nums " +
                (isEven
                  ? "text-muted-foreground"
                  : isOwed
                    ? "text-green"
                    : "text-red")
              }
            >
              ${Math.abs(netBalance).toFixed(2)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 border-l border-border pl-4">
            <Button
              size="sm"
              variant="outline"
              className="text-sm h-9"
              onClick={onSettleUp}
            >
              Settle up
            </Button>
            <Button
              size="sm"
              className="text-sm h-9"
              onClick={onAddDebt}
            >
              Add debt
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
