import type { Metadata } from "next";
import { Overpass, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import Link from "next/link";
import "./globals.css";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AppLoading } from "@/components/app-loading";
import { LogoutButton } from "@/components/logout-button";
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
            <header
              className={`sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60 ${
                user ? "md:px-8 md:ml-52 md:mr-52" : "md:px-8 max-w-5xl mx-auto w-full"
              }`}
            >
              <Link href="/" className="text-lg font-semibold">Broke Besties</Link>
              <div className="flex items-center gap-2">
                {user ? (
                  <>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/profile">Profile</Link>
                    </Button>
                    <LogoutButton />
                  </>
                ) : (
                  <>
                    <Button asChild variant="ghost" size="sm">
                      <Link href="/login">Log in</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/signup">Sign up</Link>
                    </Button>
                  </>
                )}
              </div>
            </header>
            <main
              className={`flex-1 overflow-auto p-4 ${
                user ? "md:py-6 md:px-8 md:ml-52 md:mr-52" : "md:py-6 md:px-8 max-w-5xl mx-auto w-full"
              }`}
            >
              <Suspense fallback={<AppLoading />}>{children}</Suspense>
            </main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
