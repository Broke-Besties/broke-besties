"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { LogOut, User } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { logoutAction } from "@/components/actions";

type HeaderUser = { id: string; email?: string } | null | undefined;

const SEGMENT_LABELS: Record<string, string> = {
  "": "Dashboard",
  dashboard: "Dashboard",
  groups: "Groups",
  tabs: "Tabs",
  friends: "Friends",
  debts: "Debts",
  "recurring-payments": "Recurring",
  "debt-transactions": "Transactions",
  invites: "Invites",
  requests: "Requests",
  profile: "Profile",
  ai: "AI",
  login: "Log in",
  signup: "Sign up",
};

function labelForSegment(segment: string): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
  if (/^\d+$/.test(segment)) return "Details";
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function useCrumbs(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ href: "/", label: "Dashboard", isLast: true }];
  }
  return segments.map((segment, i) => ({
    href: "/" + segments.slice(0, i + 1).join("/"),
    label: labelForSegment(segment),
    isLast: i === segments.length - 1,
  }));
}

function initials(email?: string): string {
  if (!email) return "BB";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? "");
  return letters.toUpperCase() || "BB";
}

export function AppHeader({
  user,
  notifications,
}: {
  user: HeaderUser;
  notifications?: ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = useCrumbs(pathname);

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      {user ? (
        <>
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-1 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((crumb) => (
                <Fragment key={crumb.href}>
                  <BreadcrumbItem>
                    {crumb.isLast ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!crumb.isLast && <BreadcrumbSeparator />}
                </Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        </>
      ) : (
        <Link href="/" className="text-base font-semibold tracking-tight">
          Broke Besties
        </Link>
      )}

      <div className="ml-auto flex items-center gap-2">
        {user ? (
          <>
            {notifications}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full"
                  aria-label="Account menu"
                >
                  <Avatar className="size-8">
                    <AvatarFallback>{initials(user.email)}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user.email ?? "Account"}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem asChild>
                    <button type="submit" className="w-full">
                      <LogOut />
                      Log out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Sign up</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
