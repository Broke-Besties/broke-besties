import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SiteHeader({ className }: { className?: string }) {
  return (
    <header className={cn("sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur", className)}>
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            SplitLedger
          </Link>

          <nav className="hidden items-center gap-1 text-sm text-muted-foreground md:flex">
            <Link href="/groups" className="rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground">
              Groups
            </Link>
            <Link href="/dashboard" className="rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground">
              Dashboard
            </Link>
            <Link href="/invites" className="rounded-md px-2 py-1 hover:bg-accent hover:text-accent-foreground">
              Invites
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}


