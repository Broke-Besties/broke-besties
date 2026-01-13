import type { Metadata } from "next";
import { Overpass, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppLoading } from "@/components/app-loading";
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
        <SidebarProvider>
          <AppSidebar user={user} />
          <SidebarInset>
            <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <span className="text-sm font-medium">Broke Besties</span>
            </header>
            <main className="flex-1 overflow-auto p-4 md:p-6">
              <Suspense fallback={<AppLoading />}>{children}</Suspense>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
