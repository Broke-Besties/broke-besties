"use client"

import { useState, useTransition } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MutualsBadge } from "./mutuals-badge"
import { sendFriendRequestByEmail } from "@/app/(main)/friends/actions"
import type { SuggestedUser } from "./types"

interface DiscoverGridProps {
  suggestions: SuggestedUser[]
}

export function DiscoverGrid({ suggestions }: DiscoverGridProps) {
  const [connected, setConnected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState<Set<number>>(new Set())

  const handleConnect = async (user: SuggestedUser) => {
    setLoading((prev) => new Set(prev).add(user.id))
    const result = await sendFriendRequestByEmail(user.email)
    setLoading((prev) => {
      const next = new Set(prev)
      next.delete(user.id)
      return next
    })
    if (result.success) {
      setConnected((prev) => new Set(prev).add(user.id))
    }
  }

  return (
    <div className="space-y-3">
      <SectionHeader title="Suggested Besties" />
      <div className="grid grid-cols-3 gap-2">
        {suggestions.map((person) => (
          <SuggestionCard
            key={person.id}
            user={person}
            isConnected={connected.has(person.id)}
            isLoading={loading.has(person.id)}
            onConnect={() => handleConnect(person)}
          />
        ))}
      </div>
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">
      {title}
    </p>
  )
}

interface SuggestionCardProps {
  user: SuggestedUser
  isConnected: boolean
  isLoading: boolean
  onConnect: () => void
}

function SuggestionCard({ user, isConnected, isLoading, onConnect }: SuggestionCardProps) {
  return (
    <Card className="bg-card border border-border/40 rounded-xl overflow-hidden hover:border-border/60 transition-colors">
      <CardContent className="p-3 flex flex-col items-center gap-2 text-center">
        <SuggestionAvatar avatar={user.avatar} name={user.name} initials={user.initials} />
        <SuggestionInfo name={user.name} handle={user.handle} />
        <MutualsBadge count={user.mutuals} variant="compact" />
        <ConnectButton isConnected={isConnected} isLoading={isLoading} onConnect={onConnect} />
      </CardContent>
    </Card>
  )
}

function SuggestionAvatar({ avatar, name, initials }: { avatar: string; name: string; initials: string }) {
  return (
    <Avatar className="h-11 w-11 border border-border/40 mt-1">
      <AvatarImage src={avatar} alt={name} />
      <AvatarFallback className="bg-secondary text-[11px] font-semibold text-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

function SuggestionInfo({ name, handle }: { name: string; handle: string }) {
  return (
    <div className="w-full min-w-0">
      <p className="text-[12px] font-bold text-foreground leading-none mb-[3px] truncate tracking-tight">
        {name}
      </p>
      <p className="text-[10px] text-muted-foreground/70 truncate font-normal">{handle}</p>
    </div>
  )
}

interface ConnectButtonProps {
  isConnected: boolean
  isLoading: boolean
  onConnect: () => void
}

function ConnectButton({ isConnected, isLoading, onConnect }: ConnectButtonProps) {
  return (
    <Button
      size="sm"
      onClick={onConnect}
      disabled={isConnected || isLoading}
      className={`w-full h-7 text-[11px] font-semibold border-0 transition-all ${
        isConnected
          ? "bg-money-positive/15 text-money-positive hover:bg-money-positive/20 shadow-none"
          : "bg-money-positive hover:bg-money-positive/90 text-black shadow-[0_0_10px_rgba(34,197,94,0.2)]"
      }`}
    >
      {isLoading ? "Sending..." : isConnected ? "Sent!" : "Connect"}
    </Button>
  )
}
