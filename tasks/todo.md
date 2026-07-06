# Broke Besties — UI Structure Redesign (round 2)

> Living scope doc. Prior milestone (feature/ui-structure-revamp, merged `ca36f29`) moved the
> app onto shadcn primitives. This milestone gives it an actual layout system, one shared page
> anatomy, and coherent flows. Spec: `docs/superpowers/specs/2026-07-05-ui-structure-redesign-design.md`

**Branch:** `feature/ui-redesign` (off `main` @ 92d10ee)
**Goal:** Enterprise-level structure: route groups, shared PageHeader, consistent list/feedback/confirm idioms, no dead ends. Structure only — color/visual polish still deferred.

---

## Phase 0 — Foundation (sequential, shared contracts)
- [x] Install primitives: alert-dialog, popover, command, toggle-group, spinner, collapsible, input-group
- [x] Route groups: (marketing) / (auth) / (app); minimal root layout
- [x] (app) layout: shell + sidebar badge counts; global error.tsx
- [x] Shared components: PageHeader, StatCard, StatusBadge, GoogleIcon, CommandMenu (⌘K)
- [x] Sidebar: grouped nav + SidebarRail + badges; Header: all-breakpoint trigger, ⌘K, bell fallback, drop URL breadcrumbs
- [x] Per-route loading.tsx skeletons

## Phase 1 — Areas (parallel where independent)
- [x] Auth: (auth) layout + shared AuthForm; Landing: (marketing) header + SectionHeader + Item lists
- [x] Debts: list toolbar/table/row-menu; requests inbox rebuild; /debt-transactions redirect; detail page
- [x] Groups: list cards→links w/ info scent; detail split (Sheet multi-debt, ToggleGroup filters, Combobox)
- [x] Recurring: list nesting fix + Sheet create; detail rebuild + not-found
- [x] Tabs + Alerts
- [x] Friends + Invites
- [x] AI + Profile
- [x] Dashboard rebuild (after Debts — reuses create-debt dialog)

## Phase 2 — Verify
- [x] tsc --noEmit && next build (both clean; all 35 pages generate)
- [x] Live click-through / screenshots (prod server + local Supabase): dashboard, debts, requests, groups, group detail, login — found and fixed the sidebar-gap overlap bug
- [x] Fill Review section

---

## Decisions & gotchas (read me first next session)
- **shadcn-only, don't reinvent.** Never edit existing `components/ui/*` files; add new ones via `npx shadcn add` (repo uses **pnpm**; pipe `yes n |` to decline overwrites of existing primitives).
- **`ui/dialog.tsx` is the real shadcn Radix dialog.** Use `<Dialog open onOpenChange>` + `<DialogContent>`; never the `{open && <div className="fixed inset-0">…}` pattern.
- **Color is deferred** — stock neutral theme; shadcn semantics only (`destructive` allowed).
- **No data/auth/business-logic changes** — markup/structure/flow only. Exception: `notFound()` instead of silent redirects, and link/redirect targets, which ARE the flow.
- **Route groups don't change URLs** — moving pages into `(app)/` etc. is transparent; watch relative imports when moving files.
- **Verification noise:** `npx tsc --noEmit` shows pre-existing implicit-`any` in untouched service files and `@prisma/client` errors until `npx prisma generate`. `<img>`/unused-`err` lint warnings pre-existing. Filter these out.
- **Untracked strays in working tree** (`components/site-header.tsx`, `logout-button.tsx`, `app/api/*` dirs) are stale code from another branch — do not import, do not commit.

## Review — session ending 2026-07-06

All phases shipped on `feature/ui-redesign` (10 commits). The app now has a real layout
system: (marketing)/(auth)/(app) route groups, one PageHeader anatomy on every page
(breadcrumbs with entity names on detail pages), grouped sidebar with pending-count
badges + rail, ⌘K command palette, per-route skeletons, global error boundary, and
not-found pages on all detail routes. Interaction idioms are now uniform: links are
links, destructive actions confirm via AlertDialog, every mutation toasts, empty states
use Empty with CTAs, filters are Tabs/ToggleGroup/Select, long forms are Sheets. The two
duplicate approval inboxes merged into /debts/requests (/debt-transactions redirects).
Verified: tsc + build clean, live screenshot pass on prod server.

**Exception to the no-touch-ui rule (deliberate):** `ui/sidebar.tsx` gap div fixed to use
its own `gapCollapsible` variable — the custom hover-flyout fork never applied it, so a
pinned-open sidebar overlapped content by 192px. Bug fix completing the file's own
documented intent, not a customization.

Known deferrals (noted per area in commit messages): forgot-password flow (backend),
"Resolved" history tab on the requests inbox (service change), searchUsers combobox for
recurring borrowers (service is exact-match only), reminder deadline at create time
(API), dashboard streaming/Suspense-per-section. Color/typography milestone still next.
