"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/app/notifications/actions";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: Date | string;
};

type NotificationsDropdownProps = {
  notifications: Notification[];
  unreadCount: number;
  currentUserId: string;
};

function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function NotificationsDropdown({
  notifications,
  unreadCount,
  currentUserId,
}: NotificationsDropdownProps) {
  const router = useRouter();

  // Live push: subscribe to this user's notification inserts. RLS scopes
  // Realtime delivery to rows where userId = auth.uid(), so every event here
  // is already for the current user — fire a toast and refresh the server
  // component (which re-fetches the list + unread count).
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Notification" },
        (payload) => {
          const n = payload.new as {
            title: string;
            body: string | null;
            link: string | null;
          };
          toast(n.title, {
            description: n.body ?? undefined,
            action: n.link
              ? { label: "View", onClick: () => router.push(n.link!) }
              : undefined,
          });
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, router]);

  const handleOpen = async (n: Notification) => {
    if (!n.read) {
      await markNotificationRead(n.id);
    }
    if (n.link) router.push(n.link);
    router.refresh();
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white tabular-nums">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-96 max-w-[calc(100vw-2rem)] p-0"
      >
        <div className="flex items-center justify-between px-3 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={handleMarkAll}
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />

        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            {notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="flex items-start gap-3 px-3 py-2.5"
                data-unread={!n.read}
                onSelect={(e) => {
                  e.preventDefault();
                  handleOpen(n);
                }}
              >
                <span
                  className={
                    "mt-1.5 size-2 shrink-0 rounded-full " +
                    (n.read ? "bg-transparent" : "bg-primary")
                  }
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p
                    className={
                      "text-sm " + (n.read ? "font-normal" : "font-medium")
                    }
                  >
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="truncate text-xs text-muted-foreground">
                      {n.body}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {timeAgo(n.createdAt)}
                  </p>
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
