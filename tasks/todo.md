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

**Sidebar is now 100% stock shadcn** (the old hover-flyout fork and its gap patch are
gone — `ui/sidebar.tsx` was reinstalled via `npx shadcn add sidebar`). Hover-expand
behavior lives in OUR code: `app-sidebar.tsx` drives `useSidebar().setOpen` from
mouseenter/leave (200ms close delay), and one `globals.css` rule pins the sidebar gap
at icon width so the expanded panel overlays content instead of pushing it. Desktop has
no trigger button (hover + ⌘B only); the trigger is `md:hidden` — mobile still needs it
for the Sheet. `/profile` swaps sidebar content to settings nav (`settingsNavGroups`).
Header is `fixed` (not sticky); Overpass is self-hosted with metric overrides in the
root layout — see commit 4261757, don't revert to next/font/google.

Known deferrals (noted per area in commit messages): forgot-password flow (backend),
"Resolved" history tab on the requests inbox (service change), searchUsers combobox for
recurring borrowers (service is exact-match only), reminder deadline at create time
(API), dashboard streaming/Suspense-per-section. Color/typography milestone still next.
