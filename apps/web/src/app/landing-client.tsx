"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Users, RefreshCw, Bell, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Highlighter } from "@/components/ui/highlighter";

export function LandingPageClient() {
  return (
    <div className="space-y-20 pt-24 md:pt-32">
      {/* Hero Section */}
      <div
        className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: "0ms", animationFillMode: "both" }}
      >
        <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
          Split costs,
          <br />
          <Highlighter action="highlight" color="#1d4ed8">
            not friendships
          </Highlighter>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Keep track of your shared expenses, subscriptions, and recurring payments with housemates, trips, groups, friends, and family.
        </p>
        <div className="pt-4">
          <Button asChild size="lg" className="text-base">
            <Link href="/signup">
              Get organized
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Feature Section */}
      <div className="space-y-8">
        <div
          className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "100ms", animationFillMode: "both" }}
        >
          <h2 className="text-3xl md:text-4xl font-bold">
            Your shared expenses
            <br />
            <Highlighter action="underline" color="#1d4ed8">
              need clarity.
            </Highlighter>
          </h2>
        </div>

        {/* Features + Table Side by Side */}
        <div
          className="grid md:grid-cols-2 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "150ms", animationFillMode: "both" }}
        >
          {/* Left: Vertical bullet list */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Groups</h3>
                <p className="text-muted-foreground">
                  Track expenses with roommates, trips, dinner clubs, and more. Everyone stays on the same page.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                <RefreshCw className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Recurring Payments</h3>
                <p className="text-muted-foreground">
                  Never miss a shared subscription. Netflix, utilities, rent - split them automatically.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Never Forget</h3>
                <p className="text-muted-foreground">
                  See who owes what at a glance. No more awkward &quot;hey, remember that dinner?&quot; texts.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Table */}
          <Card className="bg-gradient-to-br from-card to-muted/30">
            <CardHeader>
              <CardTitle>See everything at a glance</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-md border bg-background/60 p-3">
                <span className="text-muted-foreground">Weekend trip</span>
                <span className="font-medium text-emerald-600">+$128.40 owed to you</span>
              </div>
              <div className="flex items-center justify-between rounded-md border bg-background/60 p-3">
                <span className="text-muted-foreground">Roommates - Utilities</span>
                <span className="font-medium text-rose-600">-$42.00 you owe</span>
              </div>
              <div className="flex items-center justify-between rounded-md border bg-background/60 p-3">
                <span className="text-muted-foreground">Dinner club</span>
                <span className="font-medium text-emerald-600">+$96.75 owed to you</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Red Fact Card */}
      <div
        className="rounded-xl border border-red-900/50 bg-red-950/30 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: "250ms", animationFillMode: "both" }}
      >
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center shrink-0">
            <X className="h-5 w-5 text-red-500" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-red-500">
              The average person forgets about $300+ owed to them each year.
            </h3>
            <p className="text-muted-foreground">
              Friends say &quot;I&apos;ll pay you back&quot; but life gets busy. Without tracking, that money quietly disappears.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div
        className="rounded-2xl bg-muted/50 p-8 md:p-12 animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: "300ms", animationFillMode: "both" }}
      >
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold">
              Ready to take
              <br />
              control?
            </h2>
            <p className="text-muted-foreground">
              Join friends who know exactly who owes what.
              <br />
              Free forever. No credit card required.
            </p>
            <div className="pt-4">
              <Button asChild size="lg">
                <Link href="/signup">
                  Get started
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <Image
              src="/mascot/celebrate.png"
              alt="Celebrating mascot"
              width={300}
              height={300}
              className="object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
