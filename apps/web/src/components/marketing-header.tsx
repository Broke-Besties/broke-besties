import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

const marketingLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b bg-background">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/mascot/waving.png"
            alt=""
            width={28}
            height={28}
            className="rounded"
          />
          <span className="font-semibold tracking-tight">Broke Besties</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          {marketingLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
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
