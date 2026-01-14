"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Receipt,
  UserPlus,
  CreditCard,
  RefreshCw,
  LogIn,
  UserRoundPlus,
  Pin,
  PinOff,
  Sparkles,
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
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/tabs", label: "Tabs", icon: Receipt },
  { href: "/friends", label: "Friends", icon: UserPlus },
  { href: "/debts", label: "Debts", icon: CreditCard },
  { href: "/recurring-payments", label: "Recurring", icon: RefreshCw },
  { href: "/ai", label: "AI", icon: Sparkles },
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
  const { isMobile, setOpenMobile } = useSidebar();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 p-2">
          <Link
            href="/"
            onClick={handleLinkClick}
            className="flex aspect-square size-9 shrink-0 items-center justify-center rounded-lg overflow-hidden"
          >
            <Image
              src="/mascot/waving.png"
              alt="Broke Besties"
              width={36}
              height={36}
              className="object-cover"
            />
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
                    <Link href={link.href} onClick={handleLinkClick}>
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
                <Link href="/login" onClick={handleLinkClick}>
                  <LogIn />
                  <span>Log in</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <Link href="/signup" onClick={handleLinkClick}>
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
