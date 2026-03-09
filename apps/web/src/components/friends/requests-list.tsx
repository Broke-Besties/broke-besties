"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { MutualsBadge } from "./mutuals-badge"
import { acceptFriendRequest, rejectFriendRequest } from "@/app/(main)/friends/actions"
import type { PendingRequest } from "./types"

interface RequestsListProps {
  pendingRequests: PendingRequest[]
}

export function RequestsList({ pendingRequests }: RequestsListProps) {
  const [actioned, setActioned] = useState<Record<number, "accepted" | "ignored">>({})
  const [dismissed, setDismissed] = useState<Set<number>>(new Set())
  const router = useRouter()

  const handleAccept = async (id: number) => {
    setActioned((prev) => ({ ...prev, [id]: "accepted" }))
    await acceptFriendRequest(id)
    setTimeout(() => {
      setDismissed((prev) => new Set(prev).add(id))
      router.refresh()
    }, 600)
  }

  const handleIgnore = async (id: number) => {
    setActioned((prev) => ({ ...prev, [id]: "ignored" }))
    await rejectFriendRequest(id)
    setTimeout(() => {
      setDismissed((prev) => new Set(prev).add(id))
      router.refresh()
    }, 600)
  }

  const visibleRequests = pendingRequests.filter((r) => !dismissed.has(r.id))

  if (visibleRequests.length === 0) {
    return <EmptyRequests />
  }

  return (
    <div className="space-y-0">
      {visibleRequests.map((req, idx) => {
        const initials = req.requester.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)

        return (
          <RequestRow
            key={req.id}
            request={{
              id: req.id,
              name: req.requester.name,
              handle: req.requester.email,
              initials,
            }}
            isActioned={!!actioned[req.id]}
            onAccept={() => handleAccept(req.id)}
            onIgnore={() => handleIgnore(req.id)}
            isLast={idx === visibleRequests.length - 1}
          />
        )
      })}
    </div>
  )
}

function EmptyRequests() {
  return (
    <div className="py-16 text-center">
      <p className="text-[13px] text-muted-foreground">No pending requests.</p>
    </div>
  )
}

interface DisplayRequest {
  id: number
  name: string
  handle: string
  initials: string
}

interface RequestRowProps {
  request: DisplayRequest
  isActioned: boolean
  onAccept: () => void
  onIgnore: () => void
  isLast: boolean
}

function RequestRow({ request, isActioned, onAccept, onIgnore, isLast }: RequestRowProps) {
  return (
    <>
      <div
        className={`flex items-start gap-3 py-3 transition-opacity duration-300 ${
          isActioned ? "opacity-30 pointer-events-none" : "opacity-100"
        }`}
      >
        <RequestAvatar name={request.name} initials={request.initials} />
        <RequestInfo name={request.name} handle={request.handle} />
        <RequestActions onAccept={onAccept} onIgnore={onIgnore} />
      </div>
      {!isLast && <Separator className="bg-border" />}
    </>
  )
}

interface RequestAvatarProps {
  name: string
  initials: string
}

function RequestAvatar({ name, initials }: RequestAvatarProps) {
  return (
    <Avatar className="h-10 w-10 shrink-0 border border-border/40">
      <AvatarFallback className="bg-secondary text-[11px] font-semibold text-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

interface RequestInfoProps {
  name: string
  handle: string
}

function RequestInfo({ name, handle }: RequestInfoProps) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[13px] font-bold text-foreground leading-none mb-[3px] tracking-tight">
        {name}
      </p>
      <p className="text-[11px] text-muted-foreground/70 leading-none mb-[5px]">
        {handle}
      </p>
    </div>
  )
}

interface RequestActionsProps {
  onAccept: () => void
  onIgnore: () => void
}

function RequestActions({ onAccept, onIgnore }: RequestActionsProps) {
  return (
    <div className="flex flex-col gap-1.5 shrink-0 items-end">
      <Button
        size="sm"
        onClick={onAccept}
        className="h-7 px-3 text-[12px] font-semibold bg-money-positive hover:bg-money-positive/90 text-black border-0 shadow-[0_0_12px_rgba(34,197,94,0.25)]"
      >
        <Check className="h-3 w-3 mr-1" />
        Accept
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onIgnore}
        className="h-6 px-2 text-[11px] text-muted-foreground/60 hover:text-foreground hover:bg-secondary"
      >
        Ignore
      </Button>
    </div>
  )
}
