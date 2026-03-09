"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  CalendarClock,
  RefreshCcw,
  Users,
} from "lucide-react"
import type { FriendDashboardData } from "./types"

interface SidebarCardsProps {
  data: FriendDashboardData
}

function frequencyLabel(days: number) {
  if (days === 1) return "Daily"
  if (days === 7) return "Weekly"
  if (days === 14) return "Bi-weekly"
  if (days === 30) return "Monthly"
  if (days === 90) return "Quarterly"
  if (days === 365) return "Yearly"
  return `Every ${days}d`
}

export function SidebarCards({ data }: SidebarCardsProps) {
  const { commonGroups, sharedRecurring, friend } = data

  return (
    <div className="flex flex-col gap-3">
      {/* Common Groups — linked chips */}
      <Card className="bg-card border-border/40">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={13} className="text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">
                Common Groups
              </span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 border-border/40 text-muted-foreground"
            >
              {commonGroups.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {commonGroups.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/60 py-1">
              No groups in common with {friend.name}.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {commonGroups.map((group) => (
                <Link key={group.id} href={`/groups/${group.id}`}>
                  <Badge
                    variant="outline"
                    className="text-[11px] px-2 py-0.5 h-auto border-border/50 hover:bg-muted/40 hover:border-primary/40 transition-colors cursor-pointer"
                  >
                    <Users size={10} className="mr-1 text-muted-foreground" />
                    {group.name}
                    <span className="ml-1 text-muted-foreground/60">
                      {group.memberCount}
                    </span>
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shared Recurring — compact pills */}
      <Card className="bg-card border-border/40">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RefreshCcw size={13} className="text-muted-foreground" />
              <span className="text-[13px] font-semibold text-foreground">
                Shared Recurring
              </span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 border-border/40 text-muted-foreground"
            >
              {sharedRecurring.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {sharedRecurring.length === 0 ? (
            <p className="text-[12px] text-muted-foreground/60 py-1">
              No shared recurring payments.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {sharedRecurring.map((payment) => {
                const myShare =
                  (payment.amount * payment.splitPercentage) / 100
                return (
                  <div
                    key={payment.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-secondary/50 border border-border/30 text-[11px]"
                  >
                    <CalendarClock size={10} className="text-muted-foreground" />
                    <span className="text-foreground font-medium truncate max-w-[100px]">
                      {payment.description ?? "Recurring"}
                    </span>
                    <span className="text-muted-foreground">
                      {frequencyLabel(payment.frequency)}
                    </span>
                    <span className="text-red font-semibold tabular-nums">
                      ${myShare.toFixed(2)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card className="bg-card border-border/40">
        <CardContent className="px-4 py-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Total Lent
              </span>
              <span className="text-[15px] font-bold text-green tabular-nums">
                $
                {data.activeDebts
                  .filter((d) => d.lenderId === data.currentUserId)
                  .reduce((s, d) => s + d.amount, 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Total Owed
              </span>
              <span className="text-[15px] font-bold text-red tabular-nums">
                $
                {data.activeDebts
                  .filter((d) => d.borrowerId === data.currentUserId)
                  .reduce((s, d) => s + d.amount, 0)
                  .toFixed(2)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Settled
              </span>
              <span className="text-[15px] font-bold text-foreground tabular-nums">
                {data.settledDebts.length}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Pending
              </span>
              <span className="text-[15px] font-bold text-foreground tabular-nums">
                {data.pendingTransactions.length}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
