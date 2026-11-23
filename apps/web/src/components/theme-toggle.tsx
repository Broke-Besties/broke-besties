"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle() {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    // Persist so the choice follows the user to other devices.
    void fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => {});
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8"
      aria-label="Toggle theme"
      onClick={toggle}
    >
      {/* CSS picks the icon so server and client render the same markup. */}
      <Sun className="dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  );
}
