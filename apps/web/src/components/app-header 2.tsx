"use client"

import Link from "next/link"
import { User } from "@supabase/supabase-js"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { UserDropdown } from "@/components/user-dropdown"

interface AppHeaderProps {
  user?: User | null
}

export function AppHeader({ user }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-center bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60 border-b border-gray-200 dark:border-gray-800 w-full">
      <div className={`flex items-center justify-between w-full max-w-5xl ${user ? "md:px-8" : "md:px-8"}`}>
        <div className="flex items-center gap-2">
          {user && <SidebarTrigger />}
          <span className="text-lg font-semibold">Broke Besties</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <UserDropdown user={user} userName={user.user_metadata?.full_name ?? user.email ?? ""} />
          ) : (
            <>
              <ModeToggle />
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
