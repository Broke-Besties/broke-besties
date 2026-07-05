"use client";

import { Fragment } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bell,
  Check,
  RefreshCw,
  Receipt,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "@/components/ui/item";
import { DebtWeb } from "./debt-web";

const steps = [
  {
    title: "Start a group",
    description:
      "Invite roommates, your trip crew, or a dinner club. Everyone joins in seconds — no app download required.",
  },
  {
    title: "Add what you spend",
    description:
      "Log shared costs, attach receipts, and set recurring bills like rent or Netflix to split automatically every cycle.",
  },
  {
    title: "Settle up",
    description:
      "Broke Besties nets everything down to who owes who, so you can pay each other back in a tap.",
  },
];

const features = [
  {
    icon: Users,
    title: "Groups",
    description:
      "Roommates, road trips, dinner clubs — keep each crew and its expenses in their own space.",
  },
  {
    icon: RefreshCw,
    title: "Recurring payments",
    description:
      "Rent, utilities, subscriptions — set them once and they split automatically every cycle.",
  },
  {
    icon: Scale,
    title: "Live balances",
    description:
      "Always know who owes what, netted down to a single number you can settle in a tap.",
  },
  {
    icon: Receipt,
    title: "Receipts",
    description:
      "Attach a photo to any expense so nobody has to question the math later.",
  },
  {
    icon: Bell,
    title: "Reminders",
    description:
      "Gentle nudges when a payment is due — no more chasing friends over text.",
  },
  {
    icon: Sparkles,
    title: "Smart assistant",
    description:
      "Ask who owes what or log an expense in plain language. The math happens for you.",
  },
];

const planFeatures = [
  "Unlimited groups & friends",
  "Recurring & one-off splits",
  "Receipts, balances & history",
  "Payment reminders",
  "Smart assistant",
];

export function LandingPageClient() {
  return (
    <div className="space-y-24 py-12 md:space-y-32 md:py-16">
      {/* Hero */}
      <section className="grid items-center gap-10 md:grid-cols-2 md:gap-12">
        <div className="space-y-6 duration-500 animate-in fade-in slide-in-from-bottom-4">
          <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
            Shared expenses, settled
          </p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            Split the bill,
            <br />
            keep the friendship.
          </h1>
          <p className="max-w-md text-lg text-muted-foreground">
            Broke Besties tracks who paid, who owes, and what&apos;s recurring —
            across roommates, road trips, and dinner clubs. See every balance at
            a glance and settle up without the awkward texts.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg" className="text-base">
              <Link href="/signup">
                Get started
                <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="text-base">
              <Link href="#how-it-works">See how it works</Link>
            </Button>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <AvatarGroup>
              {["MA", "SA", "BE", "LI"].map((i) => (
                <Avatar key={i} size="sm">
                  <AvatarFallback>{i}</AvatarFallback>
                </Avatar>
              ))}
            </AvatarGroup>
            <p className="text-sm text-muted-foreground">
              Built for roommates, trips &amp; dinner clubs.
            </p>
          </div>
        </div>
        <DebtWeb />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-24 space-y-10">
        <SectionHeader
          eyebrow="How it works"
          heading="Settle up in three steps."
        />
        <ItemGroup className="border-y">
          {steps.map((step, i) => (
            <Fragment key={step.title}>
              {i > 0 && <ItemSeparator />}
              <Item className="gap-4 px-0 py-8 md:gap-8">
                <ItemMedia>
                  <span className="text-sm font-medium tabular-nums text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle className="text-xl font-semibold">
                    {step.title}
                  </ItemTitle>
                  <ItemDescription className="line-clamp-none max-w-2xl">
                    {step.description}
                  </ItemDescription>
                </ItemContent>
              </Item>
            </Fragment>
          ))}
        </ItemGroup>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 space-y-10">
        <SectionHeader
          eyebrow="Features"
          heading="Everything you need to share costs."
          description="From a quick dinner split to the apartment's monthly bills — it's all in one place."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle className="pt-2 text-lg">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground">
                {feature.description}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Why it matters — contrast band */}
      <section className="rounded-3xl bg-foreground px-6 py-14 text-background md:px-12 md:py-20">
        <div className="space-y-6">
          <SectionHeader
            align="center"
            contrast
            eyebrow="Why it matters"
            heading="The average person forgets $300+ owed to them every year."
            description={
              '"I\'ll pay you back" quietly turns into never. Broke Besties remembers, so your friendships don\'t pay the price.'
            }
          />
          <div className="pt-2 text-center">
            <Button asChild size="lg" variant="secondary" className="text-base">
              <Link href="/signup">
                Start tracking free
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="mx-auto max-w-3xl space-y-6 text-center">
        <blockquote className="text-2xl font-medium tracking-tight md:text-3xl">
          &quot;We stopped doing math at dinner. Everyone adds what they grabbed,
          and Broke Besties tells us who owes who by the end of the trip.&quot;
        </blockquote>
        <div className="flex items-center justify-center gap-3">
          <Avatar>
            <AvatarFallback>PR</AvatarFallback>
          </Avatar>
          <div className="text-left">
            <p className="font-medium">Priya R.</p>
            <p className="text-sm text-muted-foreground">
              splits a 6-person apartment
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-24 space-y-10">
        <SectionHeader
          align="center"
          eyebrow="Pricing"
          heading="Free, forever."
          description="No credit card. No premium tier. Really."
        />
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">$0</span>
              <span className="text-muted-foreground">/ forever</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ItemGroup className="gap-1.5">
              {planFeatures.map((item) => (
                <Item key={item} size="sm" className="gap-3 p-0">
                  <ItemMedia>
                    <Check className="size-4 text-muted-foreground" />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle className="font-normal">{item}</ItemTitle>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
            <Button asChild size="lg" className="w-full text-base">
              <Link href="/signup">
                Get started
                <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="grid gap-8 border-t pt-10 sm:grid-cols-2 md:grid-cols-4">
        <div className="space-y-2">
          <p className="text-lg font-semibold">Broke Besties</p>
          <p className="text-sm text-muted-foreground">
            Split costs, not friendships.
          </p>
        </div>
        <FooterColumn
          title="Product"
          links={[
            { label: "How it works", href: "#how-it-works" },
            { label: "Features", href: "#features" },
            { label: "Pricing", href: "#pricing" },
          ]}
        />
        <FooterColumn
          title="Get started"
          links={[
            { label: "Sign up", href: "/signup" },
            { label: "Log in", href: "/login" },
          ]}
        />
        <p className="text-sm text-muted-foreground sm:col-span-2 md:col-span-1 md:text-right">
          © {new Date().getFullYear()} Broke Besties
        </p>
      </footer>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  heading,
  description,
  align = "left",
  contrast = false,
}: {
  eyebrow: string;
  heading: string;
  description?: string;
  align?: "left" | "center";
  contrast?: boolean;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl space-y-3",
        align === "center" && "mx-auto text-center",
      )}
    >
      <p
        className={cn(
          "text-sm font-medium tracking-wide uppercase",
          contrast ? "text-background/60" : "text-muted-foreground",
        )}
      >
        {eyebrow}
      </p>
      <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
        {heading}
      </h2>
      {description && (
        <p
          className={cn(
            "text-lg",
            contrast ? "text-background/70" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{title}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
