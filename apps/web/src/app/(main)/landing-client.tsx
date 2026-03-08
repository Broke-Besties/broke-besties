"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  ChevronDown,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Scan,
  Sparkles,
  Users,
  Zap,
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
/*  Floating Debt Card Mockup                                                  */
/* ─────────────────────────────────────────────────────────────────────────── */
const BALANCES = [
  { name: "Sarah K.", label: "Weekend Trip", amount: "+$128.40", positive: true },
  { name: "Marcus T.", label: "Utilities", amount: "-$42.00", positive: false },
  { name: "Priya M.", label: "Dinner Club", amount: "+$96.75", positive: true },
  { name: "Jordan L.", label: "Netflix Split", amount: "+$7.50", positive: true },
];

function DebtCardMockup() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: -1 }}
      transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative w-full max-w-sm mx-auto select-none"
    >
      {/* Glow */}
      <div className="absolute inset-0 blur-3xl opacity-20 rounded-3xl bg-[#72E3AD] scale-90 translate-y-4" />

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="relative rounded-2xl border border-white/10 bg-[#111111] shadow-2xl overflow-hidden"
        style={{ rotate: -1 }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-white/8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#72E3AD]/20 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-[#72E3AD]" />
              </div>
              <span className="text-xs font-medium text-white/60 tracking-wider uppercase">Balances</span>
            </div>
            <span className="text-xs text-[#72E3AD] font-semibold">+$190.65 net</span>
          </div>
        </div>

        {/* Rows */}
        <div className="p-3 space-y-1">
          {BALANCES.map((b, i) => (
            <motion.div
              key={b.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + i * 0.08 }}
              className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-[10px] font-bold text-white/70">
                  {b.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-xs font-medium text-white/90">{b.name}</p>
                  <p className="text-[10px] text-white/40">{b.label}</p>
                </div>
              </div>
              <span className={`text-xs font-semibold tabular-nums ${b.positive ? "text-[#72E3AD]" : "text-rose-400"}`}>
                {b.amount}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/8 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[#72E3AD] animate-pulse" />
          <span className="text-[10px] text-white/40">Live • Updated just now</span>
        </div>
      </motion.div>

      {/* Floating badge */}
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, delay: 1, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-3 -right-4 rounded-full bg-[#72E3AD] text-[#0a0a0a] text-[10px] font-bold px-2.5 py-1 shadow-lg"
      >
        AI-powered
      </motion.div>
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  AI Chat Demo                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */
const CHAT_SEQUENCE = [
  { role: "user", text: "I paid $40 for dinner for me and Daniel" },
  {
    role: "agent",
    text: "Got it! I've logged:\n• Expense: Dinner — $40.00\n• You paid: $40.00\n• Daniel owes you: $20.00\n\nWant me to notify Daniel?",
  },
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 0.15, 0.3].map((d, i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#72E3AD]/60"
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 0.6, delay: d, repeat: Infinity }}
        />
      ))}
    </div>
  );
}

function AIChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const t1 = setTimeout(() => setStep(1), 400);
    const t2 = setTimeout(() => setStep(2), 1800);
    const t3 = setTimeout(() => setStep(3), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [inView]);

  return (
    <div ref={ref} className="space-y-3 max-w-md mx-auto lg:mx-0">
      {/* User message */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={step >= 1 ? { opacity: 1, y: 0 } : {}}
        className="flex justify-end"
      >
        <div className="bg-[#72E3AD]/15 border border-[#72E3AD]/25 text-white/90 text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-xs">
          {CHAT_SEQUENCE[0].text}
        </div>
      </motion.div>

      {/* Typing indicator */}
      {step === 2 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5"
        >
          <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="bg-white/6 border border-white/10 rounded-2xl rounded-tl-sm">
            <TypingIndicator />
          </div>
        </motion.div>
      )}

      {/* Agent response */}
      {step >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5"
        >
          <div className="w-7 h-7 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="bg-white/6 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/80 max-w-xs whitespace-pre-line">
            {CHAT_SEQUENCE[1].text}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Features Grid                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
const FEATURES = [
  {
    icon: Scan,
    title: "AI Receipt Extraction",
    desc: "Snap a photo. AI pulls every line item and suggests splits instantly.",
    color: "text-[#72E3AD]",
    bg: "bg-[#72E3AD]/10",
    border: "border-[#72E3AD]/20",
  },
  {
    icon: LayoutDashboard,
    title: "Real-Time Dashboard",
    desc: "Every balance, every group, updated live. No refresh needed.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
  },
  {
    icon: Zap,
    title: "Smart Splitting",
    desc: "Equal, percentage, custom amounts. AI suggests the fairest split.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    icon: Users,
    title: "Group Management",
    desc: "Roommates, trips, dinner clubs — keep every crew's finances separate.",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
  },
];

function FeaturesGrid() {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {FEATURES.map((f, i) => (
        <FadeUp key={f.title} delay={i * 0.08}>
          <div
            className={`rounded-2xl border ${f.border} bg-[#111111] p-5 h-full hover:bg-[#161616] transition-colors group`}
          >
            <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
              <f.icon className={`w-5 h-5 ${f.color}`} />
            </div>
            <h3 className="text-sm font-semibold text-white/90 mb-1.5">{f.title}</h3>
            <p className="text-sm text-white/45 leading-relaxed">{f.desc}</p>
          </div>
        </FadeUp>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Monorepo Bento                                                             */
/* ─────────────────────────────────────────────────────────────────────────── */
const FILES = [
  { indent: 0, name: "broke-besties/", type: "dir" },
  { indent: 1, name: "apps/", type: "dir" },
  { indent: 2, name: "web/", type: "dir", accent: true },
  { indent: 2, name: "mobile/", type: "dir", accent: true },
  { indent: 1, name: "packages/", type: "dir" },
  { indent: 2, name: "db/", type: "dir", accent: true },
  { indent: 2, name: "shared/", type: "dir" },
];

function MonorepoBento() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <FadeUp>
      <div ref={ref} className="rounded-2xl border border-white/10 bg-[#0d0d0d] overflow-hidden">
        {/* Terminal bar */}
        <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/8 bg-[#111111]">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-[#72E3AD]/60" />
          <span className="ml-2 text-[11px] text-white/30 font-mono">~/broke-besties</span>
        </div>

        <div className="p-5 font-mono text-[13px] space-y-0.5">
          {FILES.map((f, i) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, x: -6 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.07 }}
              className="flex items-center gap-1"
              style={{ paddingLeft: f.indent * 16 }}
            >
              <span className="text-white/20">{f.indent > 0 ? "├─ " : ""}</span>
              <span className={f.accent ? "text-[#72E3AD]" : "text-white/55"}>{f.name}</span>
            </motion.div>
          ))}
        </div>

        <div className="px-5 pb-5">
          <p className="text-[11px] text-white/30 font-mono">
            <span className="text-[#72E3AD]">$</span> pnpm dev --filter web
          </p>
        </div>
      </div>
    </FadeUp>
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
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Main Landing Page                                                          */
/* ─────────────────────────────────────────────────────────────────────────── */
export function LandingPageClient() {
  const aiSectionRef = useRef<HTMLElement>(null);

  function scrollToAI() {
    aiSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── 1. HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col justify-center pt-20 pb-16 overflow-hidden">
        <DotGrid />

        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#72E3AD]/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left copy */}
            <div className="space-y-7">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 rounded-full border border-[#72E3AD]/25 bg-[#72E3AD]/8 px-3.5 py-1.5"
              >
                <Sparkles className="w-3 h-3 text-[#72E3AD]" />
                <span className="text-xs font-medium text-[#72E3AD] tracking-wide">AI-powered expense splitting</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-5xl md:text-6xl lg:text-[4.25rem] font-bold leading-[1.08] tracking-tight"
              >
                The End of<br />
                <span className="text-[#72E3AD]">Awkward I.O.U.s</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-white/55 text-lg leading-relaxed max-w-md"
              >
                Split bills, scan receipts, and chat with your personal debt agent. Built with AI to keep your friendships <em>and</em> finances intact.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="flex flex-wrap gap-3 pt-1"
              >
                <Button
                  asChild
                  size="lg"
                  className="bg-[#72E3AD] text-[#0a0a0a] hover:bg-[#5ed4a0] font-semibold px-6"
                >
                  <Link href="/signup">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Link>
                </Button>
                <button
                  onClick={scrollToAI}
                  className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/4 hover:bg-white/8 px-5 h-10 text-sm font-medium text-white/80 transition-colors"
                >
                  See How It Works
                  <ChevronDown className="w-4 h-4" />
                </button>
              </motion.div>
            </div>

            {/* Right: Mockup */}
            <div className="lg:flex lg:justify-center lg:items-center">
              <DebtCardMockup />
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. AI AGENT SPOTLIGHT ──────────────────────────────────────────── */}
      <section
        ref={aiSectionRef}
        className="relative py-24 border-t border-white/8 scroll-mt-8"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-violet-950/10 to-transparent pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left copy */}
            <FadeUp className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/8 px-3.5 py-1.5">
                <Bot className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-medium text-violet-400 tracking-wide">Powered by LangGraph + Gemini</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-bold leading-tight">
                Just tell it what<br />happened.
              </h2>

              <p className="text-white/50 text-base leading-relaxed">
                Your personal debt agent understands natural language. Say "I covered brunch for four" and watch it parse, split, and log everything automatically.
              </p>

              <ul className="space-y-2.5">
                {[
                  "Understands casual language",
                  "Parses amounts, people & categories",
                  "Suggests who to notify",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm text-white/60">
                    <div className="w-4 h-4 rounded-full bg-[#72E3AD]/20 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#72E3AD]" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </FadeUp>

            {/* Right: Chat demo */}
            <FadeUp delay={0.15}>
              <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-5 space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/8">
                  <div className="w-2 h-2 rounded-full bg-[#72E3AD] animate-pulse" />
                  <span className="text-xs text-white/30 font-medium">Broke Besties Agent</span>
                </div>
                <AIChatDemo />
                <div className="pt-1 border-t border-white/8">
                  <div className="flex items-center gap-2 rounded-lg bg-white/4 border border-white/8 px-3 py-2">
                    <input
                      disabled
                      placeholder="Ask your agent anything…"
                      className="flex-1 bg-transparent text-sm text-white/30 placeholder:text-white/20 outline-none"
                    />
                    <Sparkles className="w-4 h-4 text-white/20" />
                  </div>
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </section>

      {/* ── 3. FEATURES GRID ───────────────────────────────────────────────── */}
      <section className="py-24 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp className="text-center mb-12 space-y-3">
            <h2 className="text-4xl md:text-5xl font-bold">
              Everything you need.<br />
              <span className="text-white/40">Nothing you don&apos;t.</span>
            </h2>
            <p className="text-white/45 text-base max-w-md mx-auto">
              A focused set of tools built around the way real friend groups handle money.
            </p>
          </FadeUp>

          <FeaturesGrid />
        </div>
      </section>

      {/* ── 4. MONOREPO BENTO ──────────────────────────────────────────────── */}
      <section className="py-16 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <FadeUp className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/4 px-3.5 py-1.5">
                <Receipt className="w-3.5 h-3.5 text-white/40" />
                <span className="text-xs font-medium text-white/40 tracking-wide">Built to scale</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold leading-snug">
                Web and mobile,<br />one codebase.
              </h2>
              <p className="text-white/45 text-base leading-relaxed">
                Broke Besties is a monorepo. Your data, your settings, your groups — all in sync across every platform you use.
              </p>
            </FadeUp>

            <MonorepoBento />
          </div>
        </div>
      </section>

      {/* ── 5. STAT HIGHLIGHT ──────────────────────────────────────────────── */}
      <section className="py-20 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6">
          <FadeUp>
            <div className="rounded-2xl border border-rose-900/40 bg-gradient-to-br from-rose-950/30 to-[#0a0a0a] p-8 md:p-12 text-center space-y-3">
              <p className="text-[3rem] md:text-[5rem] font-bold text-rose-400 leading-none tabular-nums">$300+</p>
              <p className="text-xl md:text-2xl font-semibold text-white/80">
                forgotten every year, per person.
              </p>
              <p className="text-white/40 text-base max-w-sm mx-auto">
                Friends say &ldquo;I&apos;ll pay you back&rdquo; — then life happens. Without tracking, that money quietly disappears.
              </p>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── 6. BOTTOM CTA ──────────────────────────────────────────────────── */}
      <section className="py-24 border-t border-white/8">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <FadeUp className="space-y-6">
            <h2 className="text-5xl md:text-6xl font-bold leading-tight">
              Stop forgetting.<br />
              <span className="text-[#72E3AD]">Start tracking.</span>
            </h2>
            <p className="text-white/45 text-lg">
              Free forever. No credit card. No awkward conversations.
            </p>
            <div className="pt-2">
              <Button
                asChild
                size="lg"
                className="bg-[#72E3AD] text-[#0a0a0a] hover:bg-[#5ed4a0] font-semibold px-8 h-12 text-base"
              >
                <Link href="/signup">
                  Create Free Account
                  <ArrowRight className="w-5 h-5 ml-1" />
                </Link>
              </Button>
            </div>
          </FadeUp>
        </div>
      </section>
    </div>
  );
}
