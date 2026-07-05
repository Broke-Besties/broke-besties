"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import NumberFlow from "@number-flow/react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Marketing illustration only — static demo data, not real balances.
// Coordinates are percentages in a square space (0–100); center = you.
// amount: positive = friend owes you (emerald), negative = you owe (rose).
type Friend = { name: string; initials: string; x: number; y: number; amount: number };

const POS = "#10b981"; // emerald-500 — owed to you
const NEG = "#f43f5e"; // rose-500 — you owe
const CENTER = { x: 50, y: 50 };

// 5 friends evenly placed on a ring (start at top, 72° apart).
const RING = 40;
const NAMES: Omit<Friend, "x" | "y">[] = [
  { name: "Maya", initials: "MA", amount: 24 },
  { name: "Sam", initials: "SA", amount: 30 },
  { name: "Ben", initials: "BE", amount: -18 },
  { name: "Lia", initials: "LI", amount: 12 },
  { name: "Theo", initials: "TH", amount: -8 },
];
const FRIENDS: Friend[] = NAMES.map((f, i) => {
  const a = (-90 + i * 72) * (Math.PI / 180);
  return { ...f, x: 50 + RING * Math.cos(a), y: 50 + RING * Math.sin(a) };
});

const NET = FRIENDS.reduce((s, f) => s + f.amount, 0);

type Pt = { x: number; y: number };
const shorten = (p: Pt, q: Pt, pad: number): Pt => {
  const dx = q.x - p.x, dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad };
};
const quadAt = (a: Pt, c: Pt, b: Pt, t: number): Pt => {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
};

// Build a curved edge that flows in the direction of the debt
// (friend → you when they owe you; you → friend when you owe them).
function buildEdge(f: Friend) {
  const owed = f.amount > 0;
  const rawSrc = owed ? { x: f.x, y: f.y } : CENTER;
  const rawTgt = owed ? CENTER : { x: f.x, y: f.y };
  const src = shorten(rawSrc, rawTgt, owed ? 7 : 11);
  const tgt = shorten(rawTgt, rawSrc, owed ? 11 : 7);
  const mx = (src.x + tgt.x) / 2, my = (src.y + tgt.y) / 2;
  const dx = tgt.x - src.x, dy = tgt.y - src.y;
  const bend = 0.16;
  const c = { x: mx - dy * bend, y: my + dx * bend };
  const d = `M ${src.x} ${src.y} Q ${c.x} ${c.y} ${tgt.x} ${tgt.y}`;
  const label = quadAt(src, c, tgt, 0.5);
  return { owed, color: owed ? POS : NEG, d, label };
}
const EDGES = FRIENDS.map(buildEdge);

const ariaSummary =
  "Shared expenses among friends. " +
  FRIENDS.map((f) =>
    f.amount > 0 ? `${f.name} owes you $${f.amount}` : `you owe ${f.name} $${-f.amount}`
  ).join(", ") +
  `. Net: you're owed $${NET}.`;

export function DebtWeb() {
  const reduce = useReducedMotion();
  const [net, setNet] = useState(reduce ? NET : 0);

  useEffect(() => {
    if (reduce) return;
    const t = setTimeout(() => setNet(NET), 650);
    return () => clearTimeout(t);
  }, [reduce]);

  return (
    <div
      role="img"
      aria-label={ariaSummary}
      className="relative mx-auto aspect-square w-full max-w-lg"
    >
      {/* Depth: framed surface + soft grid + ambient glow */}
      <div className="absolute inset-0 rounded-[2rem] border bg-card/60 shadow-sm" />
      <div
        className="absolute inset-0 rounded-[2rem] opacity-[0.5] [mask-image:radial-gradient(circle_at_center,black,transparent_72%)]"
        style={{
          backgroundImage:
            "radial-gradient(currentColor 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          color: "var(--muted-foreground)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 size-2/3 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: `${POS}22` }}
      />

      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full overflow-visible">
        <defs>
          {EDGES.map((e, i) => (
            <linearGradient key={i} id={`edge-${i}`} gradientUnits="userSpaceOnUse"
              x1="0" y1="0" x2="100" y2="100">
              <stop offset="0%" stopColor={e.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={e.color} stopOpacity="0.9" />
            </linearGradient>
          ))}
          <marker id="arrow-pos" markerUnits="userSpaceOnUse" markerWidth="4.5"
            markerHeight="4.5" refX="2.5" refY="2.25" orient="auto">
            <path d="M0,0 L4.5,2.25 L0,4.5 Z" fill={POS} />
          </marker>
          <marker id="arrow-neg" markerUnits="userSpaceOnUse" markerWidth="4.5"
            markerHeight="4.5" refX="2.5" refY="2.25" orient="auto">
            <path d="M0,0 L4.5,2.25 L0,4.5 Z" fill={NEG} />
          </marker>
        </defs>

        {/* faint guide rings for depth */}
        {[40, 26].map((r) => (
          <circle key={r} cx="50" cy="50" r={r} fill="none" stroke="currentColor"
            strokeWidth="0.25" className="text-border" />
        ))}

        {EDGES.map((e, i) => (
          <g key={i}>
            {/* base edge: draws in */}
            <motion.path
              d={e.d} fill="none" stroke={`url(#edge-${i})`} strokeWidth="1.4"
              strokeLinecap="round" markerEnd={`url(#arrow-${e.owed ? "pos" : "neg"})`}
              initial={reduce ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.15 * i, ease: "easeInOut" }}
            />
            {/* flowing dashes: money in motion */}
            {!reduce && (
              <motion.path
                d={e.d} fill="none" stroke={e.color} strokeWidth="1.4" strokeLinecap="round"
                strokeDasharray="1 7"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.9, strokeDashoffset: [0, -16] }}
                transition={{
                  opacity: { delay: 0.15 * i + 0.7, duration: 0.3 },
                  strokeDashoffset: { duration: 1.1, repeat: Infinity, ease: "linear" },
                }}
              />
            )}
          </g>
        ))}
      </svg>

      {/* amount pills on each edge */}
      {EDGES.map((e, i) => (
        <motion.div
          key={`pill-${i}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${e.label.x}%`, top: `${e.label.y}%` }}
          initial={reduce ? false : { opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.15 * i + 0.6 }}
        >
          <span
            className="rounded-full border bg-background px-2 py-0.5 text-xs font-semibold tabular-nums shadow-sm"
            style={{ color: e.color, borderColor: `${e.color}55` }}
          >
            {FRIENDS[i].amount > 0 ? "+" : "−"}${Math.abs(FRIENDS[i].amount)}
          </span>
        </motion.div>
      ))}

      {/* friend nodes — gentle float */}
      {FRIENDS.map((f, i) => (
        <motion.div
          key={`node-${f.name}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${f.x}%`, top: `${f.y}%` }}
          initial={reduce ? false : { opacity: 0, scale: 0.5 }}
          animate={
            reduce
              ? { opacity: 1, scale: 1 }
              : { opacity: 1, scale: 1, y: [0, -5, 0] }
          }
          transition={{
            opacity: { duration: 0.4, delay: 0.15 * i + 0.3 },
            scale: { duration: 0.4, delay: 0.15 * i + 0.3, type: "spring", bounce: 0.5 },
            y: { duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 },
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <Avatar size="lg" className="shadow-md ring-2 ring-background">
              <AvatarFallback className="bg-muted font-medium">{f.initials}</AvatarFallback>
            </Avatar>
            <span className="text-[10px] font-medium text-muted-foreground">{f.name}</span>
          </div>
        </motion.div>
      ))}

      {/* center: you + net balance */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={reduce ? false : { opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
      >
        <div className="relative flex size-28 flex-col items-center justify-center rounded-full border bg-card text-center shadow-lg">
          <span
            className="absolute inset-0 rounded-full"
            style={{ boxShadow: `0 0 0 6px ${POS}14` }}
          />
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
            You&apos;re owed
          </span>
          <span className="text-xl font-bold tabular-nums" style={{ color: POS }}>
            <NumberFlow value={net} format={{ style: "currency", currency: "USD" }} />
          </span>
          <span className="text-[10px] text-muted-foreground">net balance</span>
        </div>
      </motion.div>
    </div>
  );
}
