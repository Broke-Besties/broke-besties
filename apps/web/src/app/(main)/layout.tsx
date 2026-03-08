import { Suspense } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppLoading } from "@/components/app-loading";
import { getUser } from "@/lib/supabase";
import { AppHeader } from "@/components/app-header";

export default async function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader user={user} />
      {user ? (
        <SidebarProvider defaultOpen={false}>
          <AppSidebar user={user} />
          <SidebarInset>
            <main className="flex-1 p-4 md:py-6 md:px-8 md:ml-52 md:mr-52">
              <Suspense fallback={<AppLoading />}>{children}</Suspense>
            </main>
          </SidebarInset>
        </SidebarProvider>
      ) : (
        <main className="flex-1">
          <Suspense fallback={<AppLoading />}>{children}</Suspense>
        </main>
      )}
    </div>
  );
}
