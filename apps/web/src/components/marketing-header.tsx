import Link from "next/link"
import { User } from "@supabase/supabase-js"
import { Button } from "@/components/ui/button"
import { LayoutDashboard } from "lucide-react"
import { UserDropdown } from "@/components/user-dropdown"

interface MarketingHeaderProps {
  user?: User | null
  userName?: string
}

export function MarketingHeader({ user, userName }: MarketingHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-transparent supports-[backdrop-filter]:bg-background/80 supports-[backdrop-filter]:backdrop-blur-xl border-b border-transparent supports-[backdrop-filter]:border-border/40">
      <div className="max-w-5xl mx-auto flex items-center justify-between h-14 px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer group">
          <span className="w-2 h-2 rounded-full bg-primary transition-transform duration-200 group-hover:scale-125" />
          <span className="text-sm font-semibold text-foreground tracking-tight">
            BrokeBesties
          </span>
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-8">
          {[
            { label: "Features", href: "#features" },
            { label: "How it works", href: "#how-it-works" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Auth-aware CTA */}
        {user ? (
          <div className="flex items-center gap-2.5">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="h-8 px-3 text-[13px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Link href="/dashboard" className="flex items-center gap-1.5">
                <LayoutDashboard size={14} />
                Dashboard
              </Link>
            </Button>
            <UserDropdown user={user} userName={userName ?? ""} />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Link href="/login">Sign In</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="bg-foreground text-background hover:bg-foreground/90 font-medium cursor-pointer"
            >
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        )}
      </div>
    </header>
  )
}
