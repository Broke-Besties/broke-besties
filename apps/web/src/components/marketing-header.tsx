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
import { UserDropdown } from "@/components/user-dropdown"

interface MarketingHeaderProps {
  user?: User | null
  userName?: string
}

export function MarketingHeader({ user, userName }: MarketingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 h-14 bg-background border-b border-border">
      <div className="max-w-6xl mx-auto flex items-center justify-between h-full px-4">
        <Link href="/" className="flex items-center gap-2 cursor-pointer">
          <span className="w-2.5 h-2.5 rounded-full bg-[#72E3AD]" />
          <span className="text-sm font-bold text-foreground tracking-tight">BrokeBesties</span>
        </Link>

        <NavigationMenu className="hidden md:flex">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <a href="#features" className="bg-transparent text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Features
                </a>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <a href="#agent" className="bg-transparent text-muted-foreground hover:text-foreground transition-colors duration-200">
                  AI Agent
                </a>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
                <a href="#developers" className="bg-transparent text-muted-foreground hover:text-foreground transition-colors duration-200">
                  Developers
                </a>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>

        {/* Auth-aware CTA section */}
        {user ? (
          <div className="flex items-center gap-2.5 animate-in fade-in duration-300">
            {/* Dashboard button — ghost variant with subtle border */}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-md cursor-pointer transition-all duration-200"
            >
              <Link href="/dashboard" className="flex items-center gap-1.5">
                <LayoutDashboard size={14} className="text-muted-foreground" />
                Dashboard
              </Link>
            </Button>

            {/* User profile dropdown */}
            <UserDropdown user={user} userName={userName ?? ""} />
          </div>
        ) : (
          <div className="flex items-center gap-3 animate-in fade-in duration-300">
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild size="sm" className="bg-[#72E3AD] text-zinc-900 hover:bg-[#5ed4a0] font-semibold cursor-pointer">
              <Link href="/signup">Start for Free</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
