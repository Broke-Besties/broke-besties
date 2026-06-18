"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Users, RefreshCw, Bell, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Highlighter } from "@/components/ui/highlighter";

const features = [
  {
    icon: Users,
    title: "Groups",
    description:
      "Track expenses with roommates, trips, dinner clubs, and more. Everyone stays on the same page.",
  },
  {
    icon: RefreshCw,
    title: "Recurring payments",
    description:
      "Never miss a shared subscription. Netflix, utilities, rent — split them automatically.",
  },
  {
    icon: Bell,
    title: "Never forget",
    description:
      "See who owes what at a glance. No more awkward “hey, remember that dinner?” texts.",
  },
];

const glance = [
  { label: "Weekend trip", amount: "+$128.40 owed to you" },
  { label: "Roommates · Utilities", amount: "-$42.00 you owe" },
  { label: "Dinner club", amount: "+$96.75 owed to you" },
];

export function LandingPageClient() {
  return (
    <div className="space-y-20 pt-24 md:pt-32">
      {/* Hero */}
      <div className="space-y-6 text-center duration-500 animate-in fade-in slide-in-from-bottom-4">
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          Split costs,
          <br />
          <Highlighter action="highlight" color="#1d4ed8">
            not friendships
          </Highlighter>
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
          Keep track of your shared expenses, subscriptions, and recurring
          payments with housemates, trips, groups, friends, and family.
        </p>
        <div className="pt-4">
          <Button asChild size="lg" className="text-base">
            <Link href="/signup">
              Get organized
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Your shared expenses
            <br />
            <Highlighter action="underline" color="#1d4ed8">
              need clarity.
            </Highlighter>
          </h2>
        </div>

        <div className="grid items-start gap-8 md:grid-cols-2">
          <ItemGroup className="gap-4">
            {features.map((feature) => (
              <Item key={feature.title}>
                <ItemMedia variant="icon">
                  <feature.icon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-base">{feature.title}</ItemTitle>
                  <ItemDescription>{feature.description}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>

          <Card>
            <CardHeader>
              <CardTitle>See everything at a glance</CardTitle>
            </CardHeader>
            <CardContent>
              <ItemGroup className="gap-2">
                {glance.map((row) => (
                  <Item key={row.label} variant="outline" size="sm">
                    <ItemContent>
                      <ItemTitle className="font-normal text-muted-foreground">
                        {row.label}
                      </ItemTitle>
                    </ItemContent>
                    <ItemActions className="font-medium tabular-nums">
                      {row.amount}
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Fact callout */}
      <Card>
        <CardContent className="flex items-start gap-4 pt-6">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <TriangleAlert className="size-5 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">
              The average person forgets about $300+ owed to them each year.
            </h3>
            <p className="text-muted-foreground">
              Friends say &quot;I&apos;ll pay you back&quot; but life gets busy.
              Without tracking, that money quietly disappears.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bottom CTA */}
      <div className="rounded-2xl bg-muted/50 p-8 md:p-12">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold md:text-5xl">
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
                  <ArrowRight />
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
