"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowLeft,
  Bell,
  CheckCircle,
  HandCoins,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from "lucide-react"
import type { FriendDashboardData } from "./types"

interface FriendHeaderProps {
  data: FriendDashboardData
  onSettleUp: () => void
  onRequest: () => void
  onNudge: () => void
  onAddDebt: () => void
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function getHandle(email: string) {
  return "@" + email.split("@")[0]
}

export function FriendHeader({
  data,
  onSettleUp,
  onRequest,
  onNudge,
  onAddDebt,
}: FriendHeaderProps) {
  const { friend, netBalance, friendsSince, activeDebts, settledDebts } = data
  const isOwed = netBalance > 0
  const isEven = netBalance === 0

  const friendsSinceLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(friendsSince))

  return (
    <div className="flex flex-col gap-4">
      {/* Back nav */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          className="text-[13px] text-muted-foreground hover:text-foreground px-0 gap-1.5 h-7"
          onClick={() => window.history.back()}
        >
          <ArrowLeft size={13} />
          Friends
        </Button>
      </div>

      {/* Identity + Balance + Actions row */}
      <div className="flex items-start justify-between gap-6 flex-wrap">
        {/* Identity */}
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 rounded-xl border border-border/60 text-lg font-semibold">
            <AvatarFallback className="bg-secondary text-foreground rounded-xl text-base font-bold">
              {getInitials(friend.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-foreground leading-tight">
                {friend.name}
              </span>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border-border/50 text-muted-foreground"
              >
                <UserCheck size={9} className="mr-1" />
                Friend
              </Badge>
            </div>
            <span className="text-[12px] text-muted-foreground font-mono">
              {getHandle(friend.email)}
            </span>
            {/* Friendship health stat strip */}
            <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground/60">
              <span>{settledDebts.length} settled</span>
              <span>·</span>
              <span>{activeDebts.length} active</span>
              <span>·</span>
              <span>Friends since {friendsSinceLabel}</span>
            </div>
          </div>
        </div>

        {/* The Pulse — Net Balance */}
        <Card className="bg-card border-border/40 min-w-[200px]">
          <CardContent className="p-4 flex flex-col items-center gap-1">
            <div className="flex items-center gap-1.5 mb-1">
              {isEven ? null : isOwed ? (
                <TrendingUp size={13} className="text-green" />
              ) : (
                <TrendingDown size={13} className="text-red" />
              )}
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                {isEven ? "All Square" : isOwed ? "Owed to you" : "You owe"}
              </span>
            </div>
            <span
              className={
                "text-3xl font-bold tabular-nums " +
                (isEven
                  ? "text-foreground"
                  : isOwed
                    ? "text-green"
                    : "text-red") +
                (!isEven
                  ? isOwed
                    ? " shadow-[0_0_20px_rgba(34,197,94,0.15)]"
                    : " shadow-[0_0_20px_rgba(239,68,68,0.15)]"
                  : "")
              }
            >
              {isOwed ? "+" : isEven ? "" : "-"}$
              {Math.abs(netBalance).toFixed(2)}
            </span>
            <span className="text-[11px] text-muted-foreground/60 font-mono">
              net balance
            </span>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            className="text-[13px] h-8 px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold gap-1.5"
            onClick={onSettleUp}
          >
            <CheckCircle size={13} />
            Settle Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-[13px] h-8 px-3 border-border/50 gap-1.5"
            onClick={onRequest}
          >
            <HandCoins size={13} />
            Request
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[13px] h-8 px-3 text-muted-foreground gap-1.5"
            onClick={onNudge}
          >
            <Bell size={13} />
            Nudge
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-[13px] h-8 px-3 border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
            onClick={onAddDebt}
          >
            + Add Debt
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/30" />
    </div>
  )
}
