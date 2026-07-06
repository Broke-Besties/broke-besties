import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// Self-hosted so we can fix Overpass's vertical metrics: its oversized descent
// reservation floats text ~0.1em above optical center in every badge/button.
// Overrides put the baseline at cap-height center (cap ≈ 0.72em).
const overpass = localFont({
  src: "../fonts/overpass-latin.woff2",
  variable: "--font-overpass",
  weight: "100 900",
  declarations: [
    { prop: "ascent-override", value: "85.5%" },
    { prop: "descent-override", value: "14.5%" },
    { prop: "line-gap-override", value: "0%" },
  ],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Broke Besties",
    template: "%s · Broke Besties",
  },
  description:
    "Split expenses with friends: groups, invites, debts, and balances.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${overpass.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
