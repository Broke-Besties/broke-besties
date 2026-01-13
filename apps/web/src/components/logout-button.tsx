"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { logoutAction } from "./actions";

interface LogoutButtonProps {
  variant?: "default" | "sidebar";
}

export function LogoutButton({ variant = "default" }: LogoutButtonProps) {
  if (variant === "sidebar") {
    return (
      <form action={logoutAction}>
        <SidebarMenuButton type="submit" tooltip="Log out">
          <LogOut />
          <span>Log out</span>
        </SidebarMenuButton>
      </form>
    );
  }

  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="sm">
        Log out
      </Button>
    </form>
  );
}
