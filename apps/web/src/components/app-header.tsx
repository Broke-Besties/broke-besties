"use client"

import Image from "next/image"
import { User } from "@supabase/supabase-js"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { UserDropdown } from "@/components/user-dropdown"

interface AppHeaderProps {
  user: User
  userName: string
}

export function AppHeader({ user, userName }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        <div className="flex items-center gap-2">
          <Image
            src="/mascot/waving.png"
            alt="Broke Besties"
            width={24}
            height={24}
            className="object-cover rounded"
          />
          <span className="font-semibold text-sm text-foreground">Broke Besties</span>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <UserDropdown user={user} userName={userName} />
      </div>
    </header>
  )
}
