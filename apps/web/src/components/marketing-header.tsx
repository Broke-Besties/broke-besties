import Link from "next/link"
import { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { LayoutDashboard } from "lucide-react"

interface MarketingHeaderProps {
  user?: User | null
  userName?: string
}

export function MarketingHeader({ user, userName }: MarketingHeaderProps) {
  const displayName = userName || user?.user_metadata?.name || user?.email?.split("@")[0] || "User"
  const initial = displayName[0]?.toUpperCase() || "U"

  return (
    <header className="sticky top-0 z-50 h-14 bg-[#0a0a0a] border-b border-zinc-800">
      <div className="max-w-6xl mx-auto flex items-center justify-between h-full px-4">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <span className="w-2.5 h-2.5 rounded-full bg-[#72E3AD]" />
          <span className="text-sm font-bold text-white tracking-tight">BrokeBesties</span>
        </Link>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <a href="#features" className="bg-transparent text-zinc-400 hover:text-white transition-colors duration-200">
                  Features
                </a>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <a href="#agent" className="bg-transparent text-zinc-400 hover:text-white transition-colors duration-200">
                  AI Agent
                </a>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <a href="#developers" className="bg-transparent text-zinc-400 hover:text-white transition-colors duration-200">
                  Developers
                </a>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Auth-aware CTA section */}
        {user ? (
          <div className="flex items-center gap-2.5 animate-in fade-in duration-300">
            {/* Dashboard button — Fintech-Noir ghost variant */}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[13px] text-zinc-300 hover:text-white hover:bg-white/8 border border-zinc-700/50 rounded-md cursor-pointer transition-all duration-200"
            >
              <Link href="/dashboard" className="flex items-center gap-1.5">
                <LayoutDashboard size={14} className="text-zinc-400" />
                Dashboard
              </Link>
            </Button>

            {/* User profile pill — avatar + @handle */}
            <Link
              href="/settings"
              className="flex items-center gap-2 h-8 pl-1 pr-3 rounded-full bg-zinc-800/60 border border-zinc-700/40 hover:border-zinc-600/60 hover:bg-zinc-800/80 cursor-pointer transition-all duration-200"
            >
              <div className="w-6 h-6 rounded-full bg-[#72E3AD] text-[#0a0a0a] flex items-center justify-center text-[11px] font-bold shrink-0">
                {initial}
              </div>
              <span className="text-[12px] text-zinc-400 font-medium truncate max-w-[100px]">
                @{displayName.toLowerCase().replace(/\s+/g, "")}
              </span>
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3 animate-in fade-in duration-300">
            <Button asChild variant="ghost" size="sm" className="text-zinc-300 hover:text-white hover:bg-white/8 cursor-pointer">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="bg-[#72E3AD] text-[#0a0a0a] hover:bg-[#5ed4a0] font-semibold cursor-pointer">
              <Link href="/signup">Start for Free</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
