"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Highlighter } from "@/components/ui/highlighter";

export function HeroSection() {
  return (
    <div
      className="text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
      style={{ animationDelay: "0ms", animationFillMode: "both" }}
    >
      <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
        Split costs,
        <br />
        <Highlighter action="highlight" color="#72E3AD">
          not friendships
        </Highlighter>
      </h1>
      <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
        Keep track of your shared expenses, subscriptions, and recurring payments with housemates, trips, groups, friends, and family.
      </p>
      <div className="pt-4 flex gap-4 justify-center flex-wrap">
        <Button asChild size="lg">
          <Link href="/signup">
            Get organized
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/login">
            Sign in
          </Link>
        </Button>
      </div>
    </div>
  );
}
