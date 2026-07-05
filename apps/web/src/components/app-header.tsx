"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { LogOut, User } from "lucide-react";

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
import { CommandMenu } from "@/components/command-menu";
import { logoutAction } from "@/components/actions";

type HeaderUser = { id: string; email?: string } | null | undefined;

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
  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background px-4 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <Link href="/dashboard" className="flex items-center gap-2">
        <Image
          src="/mascot/waving.png"
          alt=""
          width={28}
          height={28}
          className="rounded"
        />
        <span className="font-semibold tracking-tight max-sm:hidden">
          Broke Besties
        </span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <CommandMenu />
        {notifications}
        {user && (
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
        )}
      </div>
    </header>
  );
}
