import { Suspense } from "react";
import { Bell } from "lucide-react";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { NotificationsWrapper } from "@/components/notifications-wrapper";
import { getUser } from "@/lib/supabase";
import { getNavCounts } from "@/lib/nav-counts";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();
  const counts = user
    ? await getNavCounts(user.id, user.email ?? "")
    : undefined;

  return (
    <div className="[--header-height:--spacing(14)]">
      {/* Sidebar starts collapsed; it expands on hover (see AppSidebar). */}
      <SidebarProvider defaultOpen={false} className="flex flex-col">
        <AppHeader
          user={user}
          notifications={
            <Suspense
              fallback={
                <Button
                  variant="ghost"
                  size="icon"
                  disabled
                  aria-label="Notifications"
                >
                  <Bell />
                </Button>
              }
            >
              <NotificationsWrapper />
            </Suspense>
          }
        />
        <div className="flex flex-1 pt-(--header-height)">
          <AppSidebar counts={counts} />
          <SidebarInset>
            <main className="flex-1 overflow-auto">
              <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
                {children}
              </div>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
