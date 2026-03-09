"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserCardProps {
  name: string
  handle: string
  avatar?: string
  initials: string
  online?: boolean
  size?: "sm" | "md" | "lg"
  children?: React.ReactNode
}

export function UserCard({
  name,
  handle,
  avatar,
  initials,
  online,
  size = "md",
  children,
}: UserCardProps) {
  const avatarSize = {
    sm: "h-8 w-8",
    md: "h-9 w-9",
    lg: "h-11 w-11",
  }[size]

  const nameSize = {
    sm: "text-[12px]",
    md: "text-[13px]",
    lg: "text-[13px]",
  }[size]

  const handleSize = {
    sm: "text-[10px]",
    md: "text-[11px]",
    lg: "text-[11px]",
  }[size]

  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0">
        <Avatar className={`${avatarSize} border border-border/40`}>
          <AvatarImage src={avatar} alt={name} />
          <AvatarFallback className="bg-secondary text-[11px] font-semibold text-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>
        {online && (
          <OnlineIndicator />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`${nameSize} font-bold text-foreground leading-none mb-[3px] tracking-tight truncate`}>
          {name}
        </p>
        <p className={`${handleSize} text-muted-foreground/70 leading-none font-normal truncate`}>
          {handle}
        </p>
        {children}
      </div>
    </div>
  )
}

export function OnlineIndicator() {
  return (
    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-money-positive border-2 border-background" />
  )
}
