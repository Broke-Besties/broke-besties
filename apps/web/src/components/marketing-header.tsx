import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"

export function MarketingHeader() {
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

        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="text-zinc-300 hover:text-white hover:bg-white/8 cursor-pointer">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild size="sm" className="bg-[#72E3AD] text-[#0a0a0a] hover:bg-[#5ed4a0] font-semibold cursor-pointer">
            <Link href="/signup">Start for Free</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
