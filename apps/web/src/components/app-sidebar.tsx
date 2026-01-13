"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Receipt,
  UserPlus,
  CreditCard,
  RefreshCw,
  LogIn,
  UserRoundPlus,
  Pin,
  PinOff,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

interface AppSidebarProps {
  user?: { id: string; email?: string } | null;
}

const navLinks = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/tabs", label: "Tabs", icon: Receipt },
  { href: "/friends", label: "Friends", icon: UserPlus },
  { href: "/debts", label: "Debts", icon: CreditCard },
  { href: "/recurring-payments", label: "Recurring", icon: RefreshCw },
];

function SidebarPinButton() {
  const { open, setOpen } = useSidebar();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 shrink-0 opacity-0 group-data-[state=expanded]:opacity-100 transition-opacity"
      onClick={() => setOpen(!open)}
      title={open ? "Unpin sidebar" : "Pin sidebar"}
    >
      {open ? <PinOff className="size-4" /> : <Pin className="size-4" />}
    </Button>
  );
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 p-2">
          <Link
            href="/"
            className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <span className="font-bold text-sm">BB</span>
          </Link>
          <div className="flex flex-1 items-center justify-between gap-2 overflow-hidden group-data-[state=expanded]:opacity-100 opacity-0 transition-opacity">
            <span className="font-semibold whitespace-nowrap">
              Broke Besties
            </span>
            <SidebarPinButton />
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navLinks.map((link) => (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton asChild isActive={isActive(link.href)}>
                    <Link href={link.href}>
                      <link.icon />
                      <span>{link.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {!user && (
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/login">
                  <LogIn />
                  <span>Log in</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/signup">
                  <UserRoundPlus />
                  <span>Sign up</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
