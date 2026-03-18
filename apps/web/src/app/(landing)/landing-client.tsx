"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  ArrowRight,
  ScanLine,
  ArrowLeftRight,
  Wallet,
  PiggyBank,
  Repeat,
  GitGraph,
  Github,
  Twitter,
  Linkedin,
} from "lucide-react";
import { motion, useInView } from "motion/react";
import { Button } from "@/components/ui/button";

/* ── Fade-up on scroll ── */
function FadeUp({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Thin decorative divider ── */
function Divider() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-12 h-px bg-border" />
      <div className="w-1 h-1 rounded-full bg-primary mx-4" />
      <div className="w-12 h-px bg-border" />
    </div>
  );
}

/* ── Hero ── */
function Hero() {
  return (
    <section className="relative flex flex-col justify-center pb-16 pt-28 md:pt-32 min-h-[80vh] overflow-hidden">
      {/* Subtle warm gradient bg */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/30 pointer-events-none" />

      {/* Accent circle */}
      <div className="absolute top-1/4 right-[10%] w-[min(35vw,400px)] h-[min(35vw,400px)] rounded-full border border-border/40 pointer-events-none opacity-40" />

      {/* Thin vertical accent */}
      <motion.div
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="absolute top-0 right-[15%] w-px h-[35vh] bg-border/60 origin-top pointer-events-none hidden lg:block"
      />

      <div className="relative max-w-5xl mx-auto px-6 w-full">
        {/* Eyebrow */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-xs font-medium tracking-[0.15em] uppercase text-muted-foreground mb-6"
        >
          Expense splitting — simplified
        </motion.p>

        {/* Headline — Cormorant serif */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-[var(--font-cormorant)] text-[clamp(2.75rem,7vw,5.5rem)] font-normal leading-[1.05] tracking-[-0.02em] text-foreground mb-6 max-w-3xl"
          style={{ fontFamily: "var(--font-cormorant), serif" }}
        >
          Split expenses with{" "}
          <em className="text-primary not-italic">friends</em>,<br />
          not friendships
        </motion.h1>

        {/* Sub copy */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="text-muted-foreground text-base md:text-lg leading-relaxed max-w-md font-light mb-10"
        >
          Track shared expenses, scan receipts with AI, settle in crypto or
          e-Transfer — all without the awkward conversations.
        </motion.p>

        {/* CTA — understated line-style */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-wrap items-center gap-6"
        >
          <Button
            asChild
            size="lg"
            className="bg-foreground text-background hover:bg-foreground/90 font-medium h-12 px-8 text-sm cursor-pointer"
          >
            <Link href="/signup">
              Start for free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
          <a
            href="#features"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer flex items-center gap-2 group"
          >
            See how it works
            <span className="inline-block w-8 h-px bg-muted-foreground/40 transition-all duration-300 group-hover:w-12 group-hover:bg-foreground" />
          </a>
        </motion.div>

        {/* Stats — minimal, inline */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="flex items-center gap-8 md:gap-12 mt-16"
        >
          {[
            { value: "10K+", label: "Splits settled" },
            { value: "$2.4M", label: "Tracked" },
            { value: "4.9", label: "User rating" },
          ].map((stat, i) => (
            <div key={stat.label} className="flex flex-col">
              <span
                className="text-2xl md:text-3xl font-normal tracking-tight text-foreground tabular-nums"
                style={{ fontFamily: "var(--font-cormorant), serif" }}
              >
                {stat.value}
              </span>
              <span className="text-[11px] text-muted-foreground tracking-wide uppercase mt-0.5">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ── How It Works ── */
function HowItWorks() {
  const steps = [
    {
      number: "01",
      title: "Create a group",
      description:
        "Invite your roommates, trip crew, or dinner squad. Everyone sees the same shared ledger.",
    },
    {
      number: "02",
      title: "Log expenses",
      description:
        "Snap a receipt and let AI split it, or add amounts manually. Tax and tip are handled automatically.",
    },
    {
      number: "03",
      title: "Settle up",
      description:
        "Pay with e-Transfer, crypto, or cash. One tap to mark it done. No more chasing people.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="py-20 md:py-28 bg-foreground text-background"
    >
      <div className="max-w-5xl mx-auto px-6">
        <FadeUp className="text-center mb-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-background/50 mb-3">
            How it works
          </p>
          <h2
            className="text-3xl md:text-4xl font-normal text-background"
            style={{ fontFamily: "var(--font-cormorant), serif" }}
          >
            Three steps to financial harmony
          </h2>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-background/10">
          {steps.map((step, i) => (
            <FadeUp key={step.number} delay={i * 0.1}>
              <div className="bg-foreground p-8 md:p-10 flex flex-col">
                <span
                  className="text-4xl font-normal text-primary/40 mb-6"
                  style={{ fontFamily: "var(--font-cormorant), serif" }}
                >
                  {step.number}
                </span>
                <h3
                  className="text-xl font-medium text-background mb-3"
                  style={{ fontFamily: "var(--font-cormorant), serif" }}
                >
                  {step.title}
                </h3>
                <p className="text-sm text-background/50 leading-relaxed font-light">
                  {step.description}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Features ── */
const FEATURES = [
  {
    icon: ScanLine,
    title: "Smart Split",
    description:
      "AI-powered receipt scanning. Friends claim items; tax & tip are auto-calculated into ledger debts.",
    tag: "AI",
  },
  {
    icon: ArrowLeftRight,
    title: "e-Transfer Ledger",
    description:
      "A manual log for Interac e-Transfers to keep group balances in sync without guesswork.",
  },
  {
    icon: Wallet,
    title: "Crypto Settlements",
    description:
      "Settle up in USDC or ETH with native Web3 wallet integration. Fast, borderless, zero-fee.",
    tag: "Web3",
  },
  {
    icon: PiggyBank,
    title: "Goal Pots",
    description:
      "Shared group savings with real-time progress bars for trips, big purchases, or rainy-day funds.",
  },
  {
    icon: Repeat,
    title: "Recurring Splits",
    description:
      "Automated monthly logic for shared rent and utilities. Set it once and never chase again.",
  },
  {
    icon: GitGraph,
    title: "Debt Graph",
    description:
      "High-density view of who owes who across your entire circle. Simplify debts with one tap.",
  },
];

function FeatureGrid() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-6">
        <FadeUp className="mb-16">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground mb-3">
            Features
          </p>
          <h2
            className="text-3xl md:text-4xl font-normal text-foreground max-w-lg"
            style={{ fontFamily: "var(--font-cormorant), serif" }}
          >
            Everything you need to split, save, and settle
          </h2>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {FEATURES.map((feature, i) => (
            <FadeUp key={feature.title} delay={i * 0.06}>
              <div className="group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <feature.icon className="w-4 h-4 text-foreground" />
                  </div>
                  {feature.tag && (
                    <span className="text-[10px] font-medium tracking-widest uppercase text-primary">
                      {feature.tag}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1.5">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-light">
                  {feature.description}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonial ── */
function Testimonial() {
  return (
    <section className="py-20 md:py-28 bg-muted/40 relative">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <FadeUp>
          {/* Large decorative quote */}
          <span
            className="text-[6rem] leading-none text-border select-none block -mb-8"
            style={{ fontFamily: "var(--font-cormorant), serif" }}
          >
            &ldquo;
          </span>
          <blockquote
            className="text-xl md:text-2xl font-normal text-foreground leading-relaxed mb-6"
            style={{ fontFamily: "var(--font-cormorant), serif" }}
          >
            <em>
              We used to dread splitting the bill after trips. Now it takes
              thirty seconds and nobody gets weird about it.
            </em>
          </blockquote>
          <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
            Sarah K. — Roommate group of 4
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

/* ── Bottom CTA ── */
function BottomCTA() {
  return (
    <section className="py-24 md:py-32">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <FadeUp className="space-y-6">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
            Ready?
          </p>
          <h2
            className="text-4xl md:text-5xl lg:text-6xl font-normal leading-[1.08] text-foreground"
            style={{ fontFamily: "var(--font-cormorant), serif" }}
          >
            Stop splitting hairs.
            <br />
            <span className="text-primary">Start splitting bills.</span>
          </h2>
          <p className="text-muted-foreground text-base font-light max-w-sm mx-auto leading-relaxed">
            Join thousands of friend groups who settled up without the
            awkwardness.
          </p>
          <div className="pt-4 flex flex-wrap gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 font-medium px-8 h-12 text-sm cursor-pointer"
            >
              <Link href="/signup">
                Create Free Account
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-border text-muted-foreground hover:text-foreground h-12 px-6 cursor-pointer"
            >
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground/50 tracking-wide">
            Free forever &middot; No credit card &middot; Real-time sync
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

/* ── Footer ── */
const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { label: "Smart Split", href: "#features" },
      { label: "Goal Pots", href: "#features" },
      { label: "Recurring", href: "#features" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-sm font-semibold text-foreground tracking-tight">
                BrokeBesties
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-light max-w-[200px]">
              Shared expenses,
              <br />
              without the drama.
            </p>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="text-[11px] font-semibold tracking-[0.12em] uppercase text-foreground mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-muted-foreground">
            &copy; {new Date().getFullYear()} BrokeBesties. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {[
              { Icon: Github, label: "GitHub", href: "https://github.com" },
              { Icon: Twitter, label: "Twitter", href: "https://twitter.com" },
              {
                Icon: Linkedin,
                label: "LinkedIn",
                href: "https://linkedin.com",
              },
            ].map(({ Icon, label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                aria-label={label}
              >
                <Icon className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ── Root ── */
export function LandingPageClient() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Hero />
      <Divider />
      <FeatureGrid />
      <HowItWorks />
      <Testimonial />
      <BottomCTA />
      <Footer />
    </div>
  );
}
