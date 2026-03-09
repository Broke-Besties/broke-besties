"use client"

import { Search, Link2, UserPlus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function FriendsHeader() {
  return (
    <div className="mb-6 space-y-4">
      <div>
        <p className="text-[11px] font-medium tracking-widest text-muted-foreground uppercase mb-1">
          BrokeBesties
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-foreground text-balance">
          Add Friends.
        </h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search besties..."
          className="pl-9 pr-20 h-9 bg-secondary border-border/40 text-[13px] placeholder:text-muted-foreground focus-visible:ring-ring/30"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex items-center gap-1 rounded border border-border/40 bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-9 text-[13px] border-border/40 bg-transparent hover:bg-secondary text-foreground gap-2"
        >
          <Link2 className="h-3.5 w-3.5" />
          Invite via Link
        </Button>
        <Button
          size="sm"
          className="flex-1 h-9 text-[13px] gap-2 bg-money-positive hover:bg-money-positive/90 text-black border-0 font-semibold"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add Friend
        </Button>
      </div>
    </div>
  )
}
