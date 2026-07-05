# Broke Besties — UI Structure Redesign (round 2)

> Living scope doc. Prior milestone (feature/ui-structure-revamp, merged `ca36f29`) moved the
> app onto shadcn primitives. This milestone gives it an actual layout system, one shared page
> anatomy, and coherent flows. Spec: `docs/superpowers/specs/2026-07-05-ui-structure-redesign-design.md`

**Branch:** `feature/ui-redesign` (off `main` @ 92d10ee)
**Goal:** Enterprise-level structure: route groups, shared PageHeader, consistent list/feedback/confirm idioms, no dead ends. Structure only — color/visual polish still deferred.

---

## Phase 0 — Foundation (sequential, shared contracts)
- [ ] Install primitives: alert-dialog, popover, command, toggle-group, spinner, collapsible, input-group
- [ ] Route groups: (marketing) / (auth) / (app); minimal root layout
- [ ] (app) layout: shell + sidebar badge counts; global error.tsx
- [ ] Shared components: PageHeader, StatCard, StatusBadge, GoogleIcon, CommandMenu (⌘K)
- [ ] Sidebar: grouped nav + SidebarRail + badges; Header: all-breakpoint trigger, ⌘K, bell fallback, drop URL breadcrumbs
- [ ] Per-route loading.tsx skeletons

## Phase 1 — Areas (parallel where independent)
- [ ] Auth: (auth) layout + shared AuthForm; Landing: (marketing) header + SectionHeader + Item lists
- [ ] Debts: list toolbar/table/row-menu; requests inbox rebuild; /debt-transactions redirect; detail page
- [ ] Groups: list cards→links w/ info scent; detail split (Sheet multi-debt, ToggleGroup filters, Combobox)
- [ ] Recurring: list nesting fix + Sheet create; detail rebuild + not-found
- [ ] Tabs + Alerts
- [ ] Friends + Invites
- [ ] AI + Profile
- [ ] Dashboard rebuild (after Debts — reuses create-debt dialog)

## Phase 2 — Verify
- [ ] tsc --noEmit && next build (changed files clean; see noise note below)
- [ ] Live click-through / screenshots + self-critique
- [ ] Fill Review section

---

## Decisions & gotchas (read me first next session)
- **shadcn-only, don't reinvent.** Never edit existing `components/ui/*` files; add new ones via `npx shadcn add` (repo uses **pnpm**; pipe `yes n |` to decline overwrites of existing primitives).
- **`ui/dialog.tsx` is the real shadcn Radix dialog.** Use `<Dialog open onOpenChange>` + `<DialogContent>`; never the `{open && <div className="fixed inset-0">…}` pattern.
- **Color is deferred** — stock neutral theme; shadcn semantics only (`destructive` allowed).
- **No data/auth/business-logic changes** — markup/structure/flow only. Exception: `notFound()` instead of silent redirects, and link/redirect targets, which ARE the flow.
- **Route groups don't change URLs** — moving pages into `(app)/` etc. is transparent; watch relative imports when moving files.
- **Verification noise:** `npx tsc --noEmit` shows pre-existing implicit-`any` in untouched service files and `@prisma/client` errors until `npx prisma generate`. `<img>`/unused-`err` lint warnings pre-existing. Filter these out.
- **Untracked strays in working tree** (`components/site-header.tsx`, `logout-button.tsx`, `app/api/*` dirs) are stale code from another branch — do not import, do not commit.

## Review
(to fill after implementation)
