# Broke Besties — UI Revamp Tracker

> Living scope doc. Update at the end of each session: check off done, add new todos,
> keep "Decisions & gotchas" current so the next session doesn't re-derive context.

**Branch:** `feature/ui-structure-revamp` (off `origin/main`)
**Goal:** Production-quality UI, shadcn for everything, nothing reinvented.
**Phase order:** structure first (this milestone), color/visual polish second (next milestone).

---

## ✅ Done

### Phase 1 — Theme + primitives (`fbb4970`)
- [x] Revert `globals.css` to stock shadcn default (new-york / neutral / Tailwind v4 OKLCH)
- [x] Remove custom HSL tokens, `--red/--green/--yellow`, `.red-box/.green-box/.yellow-box` utilities
- [x] Add 14 primitives via CLI: avatar, dropdown-menu, breadcrumb, form, alert, empty, pagination, sonner, chart, item, field, input-group, scroll-area, spinner
- [x] Mount sonner `<Toaster/>` in root layout

### Phase 2 — App shell (`6ca05fb`)
- [x] New `app-header.tsx`: SidebarTrigger + Breadcrumb + Avatar/DropdownMenu user menu
- [x] Drop magic-number gutters (`md:ml-52/mr-52`) → centered `max-w-6xl` container
- [x] Notifications rebuilt on `DropdownMenu`; `app-loading` on `Skeleton`
- [x] Delete dead `site-header.tsx` + `logout-button.tsx`

### Phase 3 — Dashboard (`83637ac`)
- [x] Alert banners, Item/Avatar lists, Empty states
- [x] Chart.js donut → shadcn chart (recharts) via `lib/chart-colors.ts`
- [x] Tab-update errors → sonner toasts

### Phase 4 — Per-screen pass
- [x] friends + invites (`84f7fd3`)
- [x] login + signup — Field primitives (`6715f22`)
- [x] profile (`6b7bfe3`)
- [x] groups list (`7df6108`)
- [x] landing + debt-transactions (`e83bfc5`)
- [x] recurring-payments list (`e697774`)
- [x] **Replace fake `ui/dialog.tsx` shim with real shadcn Radix Dialog + migrate all 10 callers** (`e4f1044`)
- [x] debts list (`2fd8521`)
- [x] debt requests — clear dead color classes (`dc32f57`)
- [x] groups/[id] chart → shadcn chart; remove chart.js + react-chartjs-2 deps (`b1f256e`)
- [x] tabs polish (`b9dd589`)
- [x] debts/[id], groups/[id], recurring/[id] detail pages — dialog migration + dead-class clear (folded into the commits above)

### Phase 5 — Verify
- [x] `npm run build` compiles + generates all 35 pages
- [x] Every changed file typecheck + lint clean

---

## ⬜ Todo / backlog

### This branch (before merge)
- [ ] **`ai-client.tsx` deep pass** — light touch only so far. Themed + no dead classes, but chat bubbles / message list not rebuilt on shadcn (`Item`/`Card`). ~24K-line file; do in its own session.
- [ ] Detail pages (`debts/[id]`, `groups/[id]`, `recurring-payments/[id]`) got the dialog migration but not a full structural pass — sweep for any remaining hand-rolled markup + ad-hoc colors.
- [ ] Run the app live (`cd apps/web && pnpm dev` → boots Supabase) and click through every route — confirm dialogs open/close, toasts fire, charts render. (Only build + typecheck verified so far, no browser walkthrough.)
- [ ] Open PR → `main`.

### Next milestone — Color / visual polish (intentionally deferred)
- [ ] Apply a real brand palette via `globals.css` tokens only (everything now uses shadcn semantics, so a token swap reskins the whole app). Earlier brainstorm direction: **"Soft Social Fintech"** — emerald→indigo, rounded, avatar-forward, big animated balance numbers.
- [ ] Re-introduce semantic positive/negative color (owed = green, owe = red) deliberately, not ad-hoc.
- [ ] Dark mode: currently stock shadcn dark; design as first-class if wanted.
- [ ] Typography: consider a display face (e.g. Bricolage Grotesque) paired with Overpass body + Geist Mono for money.

---

## Decisions & gotchas (read me first next session)
- **shadcn-only, don't reinvent** — replace hand-rolled UI with the matching primitive. Never edit existing `components/ui/*` files; add new ones via `npx shadcn add` (repo uses **pnpm**; pipe `yes n |` to decline overwrites of existing primitives).
- **`ui/dialog.tsx` is now the REAL shadcn Radix dialog** (was a custom div shim). Use `<Dialog open onOpenChange>` + `<DialogContent>` (it renders its own overlay/portal/close). Don't reintroduce the `{open && <div className="fixed inset-0">…}` pattern.
- **Color is deferred** — keep the stock neutral theme this milestone; neutralize ad-hoc colors to shadcn semantics (`primary/secondary/muted/accent/destructive`). `destructive` is allowed (it's a semantic).
- **No data/auth/business-logic changes** — markup/structure only.
- **Verification noise:** `npx tsc --noEmit` shows pre-existing implicit-`any` (untouched service/policy/action files) and `@prisma/client` errors when the client isn't generated (`npx prisma generate` clears those). `<img>`/unused-`err` lint warnings are pre-existing. Filter these out when checking your own changes.
- Spec/plan: `~/.claude/plans/cheerful-munching-boot.md`. Cross-session memory: `project-ui-structure-revamp`.

## Review — session ending 2026-06-18
Completed Phases 1–5 structure pass: stock-shadcn theme restore, app shell, dashboard, and
all primary screens restructured on shadcn primitives; replaced the dialog shim with real
shadcn Dialog across 10 callers; migrated the last Chart.js chart and dropped its deps;
cleared every dead color class. Build green, all changed files clean. 14 commits on the
branch. Remaining: ai-client deep pass, detail-page sweep, live click-through, PR, then the
color/visual milestone.
