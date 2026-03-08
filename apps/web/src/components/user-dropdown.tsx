"use client"

import { useTheme } from "next-themes"
import Link from "next/link"
import { useTransition } from "react"
import { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Settings, Newspaper, FlaskConical } from "lucide-react"
import { signOut } from "@/app/auth/actions"

const themeOptions = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
] as const

export function UserDropdown({ user, userName }: { user: User; userName: string }) {
  const { theme, setTheme } = useTheme()
  const [isPending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full h-8 w-8">
          <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
            {userName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U"}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 p-1 rounded-sm text-xs">
        <DropdownMenuLabel className="font-normal px-2 py-1.5">
          {userName && (
            <p className="text-xs font-semibold leading-tight truncate">
              {userName}
            </p>
          )}
          <p className="text-[11px] text-muted-foreground leading-tight truncate">
            {user.email}
          </p>
        </DropdownMenuLabel>

        <div className="h-[1px] bg-border/50 mx-1 my-0.5" />

        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="py-1 px-2 text-xs rounded-none">
            <Link href="/settings">
              <Settings size={13} className="mr-2 text-muted-foreground" />
              Account preferences
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem className="py-1 px-2 text-xs rounded-none">
            <FlaskConical size={13} className="mr-2 text-muted-foreground" />
            Feature previews
          </DropdownMenuItem>
          <DropdownMenuItem className="py-1 px-2 text-xs rounded-none">
            <Newspaper size={13} className="mr-2 text-muted-foreground" />
            Changelog
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <div className="h-[1px] bg-border/50 mx-1 my-0.5" />

        <div className="px-2 py-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">Theme</span>
          <div className="mt-1.5 space-y-0.5">
            {themeOptions.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                className="flex items-center gap-2 w-full rounded-none px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {theme === value ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground flex-shrink-0" />
                ) : (
                  <span className="h-1.5 w-1.5 flex-shrink-0" />
                )}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[1px] bg-border/50 mx-1 my-0.5" />

        <DropdownMenuItem
          disabled={isPending}
          onSelect={() => startTransition(() => signOut())}
          className="py-1 px-2 text-xs rounded-none"
        >
          {isPending ? "Signing out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
