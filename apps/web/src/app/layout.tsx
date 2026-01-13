import type { Metadata } from "next";
import { Overpass, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
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
        <div className="min-h-screen bg-background text-foreground">
          <SiteHeader user={user} />
          <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
            <Suspense fallback={<AppLoading />}>{children}</Suspense>
          </main>
        </div>
      </body>
    </html>
  );
}
