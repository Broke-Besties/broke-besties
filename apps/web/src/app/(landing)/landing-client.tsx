"use client";

import Link from "next/link";
import { useRef, MouseEvent } from "react";
import {
  ArrowRight,
  ScanLine,
  ArrowLeftRight,
  Wallet,
  PiggyBank,
  Repeat,
  GitGraph,
  ShieldCheck,
  Github,
  Twitter,
  Linkedin,
} from "lucide-react";
import { motion, useInView } from "motion/react";

import { Button } from "@/components/ui/button";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Utility: fade-up on scroll                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
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
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Dot Grid Background                                                        */
/* ─────────────────────────────────────────────────────────────────────────── */
function DotGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `radial-gradient(circle, hsl(var(--foreground) / 0.05) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        maskImage:
          "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  1. Hero                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative min-h-[85vh] flex flex-col justify-center pb-16 overflow-hidden">
      <DotGrid />
      {/* Gradient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-6 w-full text-center space-y-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-primary tracking-wide">
            Bank-grade security &bull; SOC2 compliant
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.06] tracking-tight text-foreground"
        >
          The smartest way to share{" "}
          <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
            expenses with your besties.
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-muted-foreground text-lg md:text-xl leading-relaxed max-w-2xl mx-auto"
        >
          Split receipts with AI, settle in crypto or e-Transfer, and never
          lose track of who owes who — all in one beautiful app.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap gap-3 justify-center pt-2"
        >
          <Button
            asChild
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-7 h-12 text-base cursor-pointer"
          >
            <Link href="/signup">
              Start for Free
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Link>
          </Button>
          <Button
            variant="outline"
            asChild
            size="lg"
            className="border-border bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground px-6 h-12 gap-2 cursor-pointer"
          >
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
          </Button>
        </motion.div>

        {/* Social proof numbers */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex items-center justify-center gap-8 md:gap-12 pt-8"
        >
          {[
            { value: "10K+", label: "Splits settled" },
            { value: "$2.4M", label: "Tracked" },
            { value: "4.9★", label: "User rating" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  2. Feature Card (Bento with mouse glow)                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
function FeatureCard({
  icon: Icon,
  title,
  description,
  tag,
  className = "",
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  tag?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`relative bg-card/60 border border-border rounded-2xl p-6 overflow-hidden group cursor-pointer ${className}`}
      style={{ "--mx": "50%", "--my": "50%" } as React.CSSProperties}
    >
      {/* Mouse glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{
          background:
            "radial-gradient(200px circle at var(--mx) var(--my), hsl(var(--primary) / 0.08), transparent 80%)",
        }}
      />

      {/* Content */}
      <div className="relative space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          {tag && (
            <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
    </motion.div>
  );
}

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
      "A manual log for Interac e-Transfers to keep the group balances in sync without the guesswork.",
  },
  {
    icon: Wallet,
    title: "Coinbase Wallet",
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
    title: "Social Debt Graph",
    description:
      'High-density view of \"who owes who\" across your entire circle. Simplify debts with one tap.',
  },
];

function FeatureGrid() {
  return (
    <section id="features" className="py-24 border-t border-border">
      <div className="max-w-6xl mx-auto px-6">
        <FadeUp className="text-center mb-14">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3">
            Features
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Everything you need to split, save, and settle.
          </h2>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">
            Six powerful tools that handle every way your group shares money —
            from receipts to rent to crypto.
          </p>
        </FadeUp>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <FadeUp key={feature.title} delay={i * 0.08}>
              <FeatureCard {...feature} />
            </FadeUp>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  3. Trust Bar                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */
function TrustBar() {
  return (
    <section className="py-16 border-t border-border">
      <div className="max-w-4xl mx-auto px-6">
        <FadeUp>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12">
            {/* SOC2 Badge */}
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-border bg-card/50">
              <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  SOC 2 Type II
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Audited annually
                </p>
              </div>
            </div>

            {/* HIPAA Badge */}
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-border bg-card/50">
              <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  HIPAA Compliant
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Data encryption at rest & transit
                </p>
              </div>
            </div>

            {/* Bank-level */}
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl border border-border bg-card/50">
              <ShieldCheck className="w-6 h-6 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  256-bit Encryption
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Bank-grade security
                </p>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  4. Bottom CTA                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
function BottomCTA() {
  return (
    <section className="py-24 border-t border-border">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <FadeUp className="space-y-6">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
            Stop splitting hairs.{" "}
            <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">
              Start splitting bills.
            </span>
          </h2>
          <p className="text-muted-foreground text-base max-w-lg mx-auto">
            Join thousands of friend groups who settled up without the awkwardness.
          </p>
          <div className="pt-2 flex flex-wrap gap-3 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold px-8 h-12 text-base cursor-pointer"
            >
              <Link href="/signup">
                Create Free Account
                <ArrowRight className="w-5 h-5 ml-1.5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground h-12 px-6 cursor-pointer"
            >
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground/60">
            Free forever &bull; No credit card &bull; Real-time sync
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  5. Footer                                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
const FOOTER_SECTIONS = [
  {
    title: "Product",
    links: [
      { label: "Smart Split", href: "#features" },
      { label: "Goal Pots", href: "#features" },
      { label: "Recurring Splits", href: "#features" },
      { label: "Pricing", href: "#" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Roommates", href: "#" },
      { label: "Travel Groups", href: "#" },
      { label: "Couples", href: "#" },
      { label: "Teams", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help Center", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Changelog", href: "#" },
      { label: "Status", href: "#" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "API Docs", href: "#" },
      { label: "GitHub", href: "https://github.com" },
      { label: "Self-Host", href: "#" },
      { label: "Contributing", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
];

function Footer() {
  return (
    <footer className="border-t border-border bg-card/30">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Sitemap grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              <h4 className="text-sm font-semibold text-foreground mb-3">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <span className="text-sm font-bold text-foreground tracking-tight">
              BrokeBesties
            </span>
          </div>

          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} BrokeBesties. All rights reserved.
          </p>

          <div className="flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
              aria-label="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
              aria-label="Twitter"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
              aria-label="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Root                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
export function LandingPageClient() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Hero />
      <FeatureGrid />
      <TrustBar />
      <BottomCTA />
      <Footer />
    </div>
  );
}
