import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { AppLoading } from "@/components/app-loading";
import { getUser } from "@/lib/supabase";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Broke Besties",
  description: "Split expenses with friends: groups, invites, debts, and balances.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-background text-foreground">
          <SiteHeader user={user} />
          <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
            <div className="relative">
              <div className="pointer-events-none absolute inset-x-0 -top-10 h-44 bg-gradient-to-b from-primary/10 to-transparent blur-2xl" />
              <Suspense fallback={<AppLoading />}>{children}</Suspense>
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
