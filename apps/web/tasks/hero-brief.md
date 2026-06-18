# Hero redesign brief — Broke Besties

Paste this back to me (with any edits) when you want the hero built.

---

## The prompt

> Redesign the logged-out landing **hero** for Broke Besties (`src/app/landing-client.tsx`,
> rendered by `src/app/page.tsx`). Build only the hero (top fold); leave the rest of the page.
> Use the `frontend-design` skill. Follow the constraints, content checklist, and quality bar
> below. Take one real, justified aesthetic risk for the signature element — do not ship the
> generic centered-headline-plus-button hero. Verify it live with Playwright at desktop and
> mobile widths before claiming done.

---

## Product context (ground the design here)

- **What it is:** an app for splitting and tracking shared expenses among friends — groups,
  trips, roommates, recurring bills — so everyone knows who owes what and can settle up.
- **Audience:** young adults, roommates, students, friend groups. Casual, social, a little
  cheeky. Not corporate fintech.
- **Brand name** "Broke Besties" is warm and playful. A friendly mascot exists
  (`/public/mascot/{celebrate,waving,mascot}.png`).
- **The emotional job:** money between friends is awkward. The product removes the awkwardness.
  The hero should make a visitor feel "this keeps things clear *without* making it weird."
- **The core concept worth visualizing:** the credit/debit duality — "owed to you" vs
  "you owe" — and how messy IOUs resolve to a clean net balance.

## The hero's single job

Convince a logged-out visitor in ~5 seconds that this app makes splitting costs with friends
effortless, and get them to click **Get started**. Everything on the hero serves that.

## Content checklist (what a strong hero here includes)

1. **Eyebrow / category line** — orienting label (e.g. "Shared expenses, settled").
2. **Headline** — the thesis, tight, ~2 lines. Benefit-led, plain language, a little warmth.
   Not feature soup.
3. **Subhead** — one sentence naming the concrete value: groups, trips, recurring bills, settle up.
4. **Primary CTA** → `/signup` ("Get started"). **Secondary** → `/login` ("Log in"), quieter.
5. **Trust / reassurance microcopy** — e.g. "Free forever · no credit card." Small, under CTAs.
6. **Signature visual** — the memorable thing (see options). This is where the risk goes.
7. (Optional) **social proof sliver** — avatars + "splitting with friends everywhere," only if
   it doesn't feel fake.

## Signature element — pick/refine one (must look intentional, not decorative)

- **Realistic product preview:** a polished, slightly-angled mock of the actual balances/group
  UI (real shadcn components, real-looking data) — sells the product by showing it. Lowest risk,
  high payoff. Animate values in with `@number-flow/react`.
- **Credit/debit split panel:** two stacked cards, "Owed to you" (green, ticking up) and
  "You owe" (warm), netting to one number. Encodes the core concept directly.
- **Debt connection diagram — done well:** friends as nodes, debts as edges, resolving to a net.
  ⚠️ The earlier attempt looked amateurish (floating circles + line stubs). Only revisit this if
  it's executed to a high finish: real depth, proper spacing, legible labels, a clear "settle"
  payoff — otherwise prefer the product preview.

## Hard constraints

- **Stack:** Next 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui. `landing-client.tsx` is
  already `"use client"`.
- **No new dependencies.** Already available: `motion` (animation), `@number-flow/react`
  (animated numbers), `recharts`, `lucide-react`, `next/image`, the mascot PNGs.
- **Structure & content first; color/brand/font polish is a later pass.** Use existing neutral
  shadcn tokens (`foreground`, `muted`, `muted-foreground`, `border`, `card`). Don't invent a
  palette or hardcode hex (the current `#1d4ed8` rough-notation highlight is the kind of ad-hoc
  thing to remove). Make color easy to add later, don't bake it in now.
- **Reuse existing components** (`Button`, `Card`, `Avatar`, `Item`) instead of new primitives.
- Hero renders inside the app's `max-w-6xl` padded container with `AppHeader` on top — design
  for that width; full-bleed needs deliberate breakout.

## Quality bar (the floor, executed quietly)

- Responsive: looks deliberate at mobile (stacked) and desktop (two-column). No overflow, no
  cramped labels.
- Visible keyboard focus on CTAs; logical tab order.
- `prefers-reduced-motion` respected — animations degrade to the final settled state.
- Any non-text visual (preview/diagram) has a text alternative (`aria-label` / `role="img"`).
- `npx tsc --noEmit` clean for changed files.

## Anti-patterns to avoid

- The generic "big centered headline + one button + gradient blob" hero.
- Floating, under-styled SVG shapes that read as a wireframe, not a product.
- Feature-list-as-headline; clever-over-clear copy.
- Hardcoded brand colors before the color pass.
- Adding a graph/3D library for what is essentially a static illustration.

## Verification

Run the dev server, open `/` logged out (it redirects to `/dashboard` when authenticated — use a
fresh browser). Screenshot desktop (~1280px) and mobile (~390px) with Playwright, review both,
toggle reduced motion, then report with the screenshots.
