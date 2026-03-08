import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppLoading } from "@/components/app-loading";
import { getUser } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/app-header";

export default async function MainLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true },
  });
  const userName = dbUser?.name ?? "";

  return (
    <SidebarProvider defaultOpen={false} className="flex-col h-[100dvh] overflow-hidden">
      <AppHeader user={user} userName={userName} />
      <div className="flex flex-1 min-h-0 w-full">
        <AppSidebar user={user} />
        <SidebarInset className="flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto overscroll-none p-4 md:p-6">
            <div className="mx-auto w-full max-w-screen-xl">
              <Suspense fallback={<AppLoading />}>{children}</Suspense>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
