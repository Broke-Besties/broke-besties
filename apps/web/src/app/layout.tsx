import type { Metadata } from "next";
import { Overpass, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppLoading } from "@/components/app-loading";
import { NotificationsWrapper } from "@/components/notifications-wrapper";
import { Toaster } from "@/components/ui/sonner";
import { getUser } from "@/lib/supabase";

const overpass = Overpass({
  variable: "--font-overpass",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Broke Besties",
  description:
    "Split expenses with friends: groups, invites, debts, and balances.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getUser();

  return (
    <html lang="en">
      <body
        className={`${overpass.variable} ${geistMono.variable} antialiased`}
      >
        <SidebarProvider defaultOpen={false}>
          {user && <AppSidebar user={user} />}
          <SidebarInset>
            <AppHeader
              user={user}
              notifications={
                <Suspense fallback={null}>
                  <NotificationsWrapper />
                </Suspense>
              }
            />
            <main className="flex-1 overflow-auto">
              <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
                <Suspense fallback={<AppLoading />}>{children}</Suspense>
              </div>
            </main>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
