"use client";

import Link from "next/link";
import { useRef, MouseEvent } from "react";
import {
  ArrowRight,
  Camera,
  Github,
  Database,
  Layers,
  Cpu,
  Sparkles,
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
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
        backgroundSize: "28px 28px",
        maskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
        WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 0%, black 30%, transparent 100%)",
      }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  2. Hero                                                                    */
/* ─────────────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center pb-16 overflow-hidden">
      <DotGrid />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-[#72E3AD]/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 w-full text-center space-y-8">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3.5 py-1.5"
        >
          <Sparkles className="w-3 h-3 text-violet-400" />
          <span className="text-xs font-medium text-violet-300 tracking-wide">
            Powered by LangGraph + Gemini
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.06] tracking-tight"
        >
          Build Wealth.{" "}
          <span
            className="bg-gradient-to-r from-[#72E3AD] to-cyan-400 bg-clip-text text-transparent"
          >
            Stay Besties.
          </span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-zinc-400 text-lg leading-relaxed max-w-xl mx-auto"
        >
          Powered by Supabase real-time sync, LangGraph automation, and Gemini AI — so your group finances just work.
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
            className="bg-[#72E3AD] text-[#0a0a0a] hover:bg-[#5ed4a0] font-semibold px-7 h-11"
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
            className="border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-white px-6 h-11 gap-2"
          >
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              <Github className="w-4 h-4" />
              View on GitHub
            </a>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  3. Bento Feature Grid                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

/* Mini bar chart SVG */
function MiniBarChart() {
  const bars = [40, 70, 55, 90, 65, 80, 45, 95, 60, 75];
  return (
    <svg viewBox="0 0 120 40" className="w-full h-10" preserveAspectRatio="none">
      {bars.map((h, i) => (
        <rect
          key={i}
          x={i * 12 + 2}
          y={40 - h * 0.38}
          width={8}
          height={h * 0.38}
          rx={2}
          fill={i === 7 ? "#72E3AD" : "rgba(114,227,173,0.25)"}
        />
      ))}
    </svg>
  );
}

/* LangGraph node diagram SVG */
function NodeDiagram() {
  return (
    <svg viewBox="0 0 160 80" className="w-full h-16">
      {/* Lines */}
      <line x1="45" y1="40" x2="75" y2="40" stroke="rgba(114,227,173,0.4)" strokeWidth="1.5" strokeDasharray="4 2" />
      <line x1="105" y1="40" x2="135" y2="40" stroke="rgba(114,227,173,0.4)" strokeWidth="1.5" strokeDasharray="4 2" />
      {/* Nodes */}
      <circle cx="25" cy="40" r="14" fill="#18181b" stroke="#72E3AD" strokeWidth="1.5" />
      <text x="25" y="44" textAnchor="middle" fontSize="8" fill="#72E3AD" fontFamily="monospace">parse</text>
      <circle cx="90" cy="40" r="14" fill="#18181b" stroke="rgba(114,227,173,0.5)" strokeWidth="1.5" />
      <text x="90" y="44" textAnchor="middle" fontSize="8" fill="rgba(114,227,173,0.7)" fontFamily="monospace">split</text>
      <circle cx="152" cy="40" r="14" fill="#18181b" stroke="rgba(114,227,173,0.3)" strokeWidth="1.5" />
      <text x="152" y="44" textAnchor="middle" fontSize="8" fill="rgba(114,227,173,0.5)" fontFamily="monospace">log</text>
      {/* Arrows */}
      <polygon points="76,37 83,40 76,43" fill="rgba(114,227,173,0.4)" />
      <polygon points="136,37 143,40 136,43" fill="rgba(114,227,173,0.4)" />
    </svg>
  );
}

/* Bento card with mouse-glow */
function BentoCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    ref.current.style.setProperty("--mx", `${x}px`);
    ref.current.style.setProperty("--my", `${y}px`);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`relative bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden group ${className}`}
      style={
        {
          "--mx": "50%",
          "--my": "50%",
        } as React.CSSProperties
      }
    >
      {/* Mouse glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl"
        style={{
          background: "radial-gradient(200px circle at var(--mx) var(--my), rgba(114,227,173,0.08), transparent 80%)",
        }}
      />
      {children}
    </motion.div>
  );
}

const BALANCES = [
  { name: "Sarah K.", label: "Weekend Trip", amount: "+$128.40", positive: true },
  { name: "Marcus T.", label: "Utilities", amount: "-$42.00", positive: false },
  { name: "Priya M.", label: "Dinner Club", amount: "+$96.75", positive: true },
];

function BentoGrid() {
  return (
    <div id="features" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Card 1 — Large debt dashboard (col-span-2) */}
      <BentoCard className="lg:col-span-2 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#72E3AD]/20 flex items-center justify-center text-[10px] font-bold text-[#72E3AD]">
              JD
            </div>
            <div>
              <p className="text-xs font-semibold text-white/90">Group Balances</p>
              <p className="text-[10px] text-zinc-500">Weekend Trip • 4 members</p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#72E3AD]">+$190.65 net</span>
        </div>

        {/* Balance rows */}
        <div className="space-y-1">
          {BALANCES.map((b) => (
            <div key={b.name} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/4">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[9px] font-bold text-white/60">
                  {b.name.split(" ").map((n) => n[0]).join("")}
                </div>
                <div>
                  <p className="text-xs font-medium text-white/85">{b.name}</p>
                  <p className="text-[10px] text-zinc-500">{b.label}</p>
                </div>
              </div>
              <span className={`text-xs font-bold tabular-nums ${b.positive ? "text-[#72E3AD]" : "text-rose-400"}`}>
                {b.amount}
              </span>
            </div>
          ))}
        </div>

        {/* Mini chart */}
        <div className="pt-2">
          <p className="text-[10px] text-zinc-500 mb-1.5">Spending this month</p>
          <MiniBarChart />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 pt-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#72E3AD] animate-pulse" />
          <span className="text-[10px] text-zinc-500">Live • Updated just now</span>
        </div>
      </BentoCard>

      {/* Card 2 — AI Receipt Scanning */}
      <BentoCard className="p-6 flex flex-col justify-between min-h-[220px]">
        <div className="space-y-3">
          <div className="relative inline-flex">
            <div className="w-12 h-12 rounded-2xl bg-zinc-800 flex items-center justify-center">
              <Camera className="w-6 h-6 text-zinc-300" />
            </div>
            {/* Gemini G badge */}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
              <span className="text-[8px] font-black text-white">G</span>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">AI Receipt Scanning</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">Snap a photo and Gemini AI instantly extracts every line item.</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-zinc-800/60 px-3 py-2">
          <span className="text-[11px] font-mono text-[#72E3AD]">Snap → Split → Done</span>
        </div>
      </BentoCard>

      {/* Card 3 — LangGraph Agent */}
      <BentoCard className="md:col-span-2 lg:col-span-1 p-6 space-y-4">
        <div className="space-y-1">
          <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/25 flex items-center justify-center mb-3">
            <Cpu className="w-5 h-5 text-violet-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">LangGraph Agent</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">Multi-step reasoning for complex expense logic.</p>
        </div>
        <NodeDiagram />
        <p className="text-[10px] text-zinc-600 font-mono">parse → split → log</p>
      </BentoCard>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  4. Social Proof / Stat Bar                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
function StatBar() {
  return (
    <section className="py-20 border-t border-zinc-800">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <FadeUp>
          <p className="text-3xl md:text-5xl font-bold text-white leading-tight mb-4">
            &ldquo;The average person forgets{" "}
            <span className="text-rose-400">$300+</span>{" "}
            owed to them each year.&rdquo;
          </p>
          <p className="text-zinc-500 text-base mt-4">
            BrokeBesties tracks every cent, automatically.
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  5. Developer Trust Section                                                 */
/* ─────────────────────────────────────────────────────────────────────────── */
function CodeToken({ children, color }: { children: React.ReactNode; color: string }) {
  return <span style={{ color }}>{children}</span>;
}

function CodeBlock() {
  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden font-mono text-[12px] leading-relaxed">
      {/* Terminal bar */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#72E3AD]/60" />
        <span className="ml-2 text-[11px] text-zinc-500">langgraph-tool.ts</span>
      </div>
      <pre className="p-5 text-zinc-300 overflow-x-auto whitespace-pre">
        <code>
          <CodeToken color="#6b7280">{"// LangGraph Tool — addDebt\n"}</CodeToken>
          <CodeToken color="#c084fc">{"const "}</CodeToken>
          <CodeToken color="#e5e7eb">{"addDebtTool = "}</CodeToken>
          <CodeToken color="#c084fc">{"tool"}</CodeToken>
          <CodeToken color="#e5e7eb">{"(async ({ amount, paidBy, participants }) => {'\n'  "}</CodeToken>
          <CodeToken color="#c084fc">{"const "}</CodeToken>
          <CodeToken color="#e5e7eb">{"split = amount / participants.length;\n  "}</CodeToken>
          <CodeToken color="#c084fc">{"await "}</CodeToken>
          <CodeToken color="#e5e7eb">{"db.debt."}</CodeToken>
          <CodeToken color="#72E3AD">{"createMany"}</CodeToken>
          <CodeToken color="#e5e7eb">{"({ data: participants."}</CodeToken>
          <CodeToken color="#72E3AD">{"map"}</CodeToken>
          <CodeToken color="#e5e7eb">{"(p => ({\n    amount: split, owedBy: p, owedTo: paidBy\n  }))});\n  "}</CodeToken>
          <CodeToken color="#c084fc">{"return "}</CodeToken>
          <CodeToken color="#72E3AD">{"`Split $"}</CodeToken>
          <CodeToken color="#e5e7eb">{"${"}</CodeToken>
          <CodeToken color="#72E3AD">{"amount"}</CodeToken>
          <CodeToken color="#e5e7eb">{"}"}</CodeToken>
          <CodeToken color="#72E3AD">{" between ${"}</CodeToken>
          <CodeToken color="#e5e7eb">{"participants."}</CodeToken>
          <CodeToken color="#72E3AD">{"join"}</CodeToken>
          <CodeToken color="#e5e7eb">{"(', ')"}</CodeToken>
          <CodeToken color="#72E3AD">{"}`"}</CodeToken>
          <CodeToken color="#e5e7eb">{";\n}, { name: "}</CodeToken>
          <CodeToken color="#72E3AD">{'"add_debt"'}</CodeToken>
          <CodeToken color="#e5e7eb">{", schema: z."}</CodeToken>
          <CodeToken color="#72E3AD">{"object"}</CodeToken>
          <CodeToken color="#e5e7eb">{"({...}) });"}</CodeToken>
        </code>
      </pre>
    </div>
  );
}

const STACK = [
  { icon: Database, label: "Supabase Postgres", desc: "Real-time sync, row-level security" },
  { icon: Layers, label: "Prisma ORM", desc: "Type-safe database access" },
  { icon: Cpu, label: "LangGraph", desc: "Multi-step agent orchestration" },
  { icon: Sparkles, label: "Gemini 2.0", desc: "Receipt parsing & NLP" },
];

function DeveloperSection() {
  return (
    <section id="developers" className="py-24 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left */}
          <FadeUp className="space-y-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-snug">
                Built on real infrastructure.
              </h2>
              <p className="text-zinc-400 text-base leading-relaxed">
                No toy stack. Every layer is production-grade and battle-tested.
              </p>
            </div>
            <ul className="space-y-4">
              {STACK.map((item) => (
                <li key={item.label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="w-4 h-4 text-[#72E3AD]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </FadeUp>

          {/* Right: Code block */}
          <FadeUp delay={0.15}>
            <CodeBlock />
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  6. Bottom CTA                                                              */
/* ─────────────────────────────────────────────────────────────────────────── */
function BottomCTA() {
  return (
    <section className="py-24 border-t border-zinc-800">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <FadeUp className="space-y-6">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            Stop splitting hairs.{" "}
            <span className="bg-gradient-to-r from-[#72E3AD] to-cyan-400 bg-clip-text text-transparent">
              Start splitting bills.
            </span>
          </h2>
          <div className="pt-2">
            <Button
              asChild
              size="lg"
              className="bg-[#72E3AD] text-[#0a0a0a] hover:bg-[#5ed4a0] font-semibold px-8 h-12 text-base"
            >
              <Link href="/signup">
                Create Free Account
                <ArrowRight className="w-5 h-5 ml-1.5" />
              </Link>
            </Button>
          </div>
          <p className="text-xs text-zinc-600">
            Free forever &bull; No credit card &bull; Real-time sync
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */
/*  Root                                                                       */
/* ─────────────────────────────────────────────────────────────────────────── */
export function LandingPageClient() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <Hero />

      {/* Bento grid */}
      <section id="agent" className="py-24 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 space-y-4">
          <FadeUp className="mb-8">
            <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Features</p>
            <h2 className="text-3xl md:text-4xl font-bold text-white">
              Everything in one place.
            </h2>
          </FadeUp>
          <BentoGrid />
        </div>
      </section>

      <StatBar />
      <DeveloperSection />
      <BottomCTA />
    </div>
  );
}
