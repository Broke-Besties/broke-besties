# UI Structure Redesign — shadcn components & flows (no color changes)

**Date:** 2026-07-05 · **Branch:** `feature/ui-redesign` (off `main`)
**Scope:** Structure, component choice, layout, and page-to-page flows only. No palette, typography, or theme changes. Never edit `components/ui/*` primitives — compose and wrap only.

## Why

A 10-agent audit of every page on `main` found the app has good primitives but no system:

- **No layout architecture.** Marketing, auth, and the app all render inside one root shell (`SidebarProvider` + `max-w-6xl`). Login can't center itself, the landing page can't go full-bleed, and one dashboard-shaped skeleton is the loading state for every route.
- **No shared page anatomy.** Every page hand-rolls its own header; h1 scales differ across sibling pages; detail pages use ghost "Back" buttons instead of breadcrumbs; header breadcrumbs are URL-derived and render `/debts/42` as "Debts / Details".
- **Three list idioms in one area** (table / item-group / stacked cards in `/debts*`), three hand-rolled filter-pill systems on one page (`/groups/[id]`), two duplicate approval inboxes (`/debts/requests` and `/debt-transactions`).
- **Destructive actions with no confirm** (tab delete, friend remove, reject request, `window.confirm` for recurring delete), silent mutation failures, three different error conventions (toast / inline div / Alert).
- **Dead ends:** approval cards that don't link to the debt they modify, `/invites` orphaned from nav, `/ai` fully disabled with no CTA when the user has no groups, banners that say "review them on your debts" with no link.
- **God components:** dashboard client (768 lines), group detail client (~940 lines).

## Design

### 1. Layout architecture — route groups

URLs unchanged; files move.

```
app/
  layout.tsx              → minimal root: html/body/fonts/Toaster only
  (marketing)/
    layout.tsx            → marketing header (brand + anchor nav + Log in / Sign up) + page
    page.tsx              → landing (moved)
  (auth)/
    layout.tsx            → min-h-svh grid place-items-center, max-w-md slot, brand link
    login/page.tsx        → thin wrapper around shared AuthForm
    signup/page.tsx       → thin wrapper around shared AuthForm
  (app)/
    layout.tsx            → AppHeader + AppSidebar + SidebarInset + max-w-6xl container
    error.tsx             → Empty (icon/title/description) + "Try again" Button
    dashboard/ debts/ groups/ friends/ invites/ tabs/
    recurring-payments/ debt-transactions/ alerts/ ai/ profile/
```

Each major route gets its own `loading.tsx` shaped like the real page. Detail routes (`debts/[id]`, `groups/[id]`, `recurring-payments/[id]`) get `not-found.tsx` and use `notFound()` instead of silently redirecting to /dashboard or crashing.

### 2. Shared components (new, in `components/`)

- **`page-header.tsx`** — the single page anatomy: optional `Breadcrumb` (real entity names), `h1 text-2xl font-semibold tracking-tight`, muted description, right-aligned actions slot. Every page uses it. Kills all ad-hoc "Back to X" ghost buttons: list pages have no breadcrumb; detail pages get `Parent / {entity}`.
- **`command-menu.tsx`** — ⌘K `CommandDialog`: navigate to every page + quick actions (Add debt, Create group, Add friend, Add tab). Trigger: search button in header + keyboard shortcut. The one "enterprise signature" element.
- **`stat-card.tsx`** — dashboard-01 SectionCards shape: `CardDescription` label, large `CardTitle` value (keeps NumberFlow), icon in `CardAction`. Stat cards are always static/informational — never secret toggles or filters.
- **`status-badge.tsx`** — one Badge treatment for pending/paid/active/inactive (variant mapping only, no new colors).
- **`google-icon.tsx`** — extracted, shared by both auth pages.

### 3. Interaction rules (applied everywhere)

- **Navigation is links.** Rows/cards navigate via `asChild` + `next/link` (prefetch, cmd-click). Never `router.push` onClick on divs. Row actions live in a `DropdownMenu` outside the anchor (fixes invalid button-inside-anchor on recurring list).
- **Destructive = AlertDialog.** Delete tab/debt/recurring/friend-remove, reject request, approve a delete request.
- **Feedback = sonner.** Every mutation toasts success and failure. Form-level errors: `Alert` destructive with title+description. Field errors: `FieldError` + `aria-invalid`.
- **Empty states = `Empty`** with a CTA that advances the flow (never bare `<p>`, never dashed hand-rolled cards).
- **Filters = `Tabs` / `ToggleGroup` / `Select`** in one toolbar row. Never clickable stat cards, never variant-swapped Button pairs.
- **Long multi-section forms = `Sheet`**, not scroll-trapped Dialogs (create recurring payment, multi-debt creation). Short forms stay Dialogs.

New primitives to install: `alert-dialog`, `popover`, `command`, `toggle-group`, `spinner`, `collapsible`, `input-group`. (No react-hook-form migration, no TanStack table, no date-picker — native `<input type=date>` stays.)

### 4. Shell

- **Sidebar:** labeled `SidebarGroup`s — Overview (Dashboard), Money (Debts, Recurring, Tabs), People (Groups, Friends), Tools (AI Assistant). `SidebarRail` so desktop can collapse. `SidebarMenuBadge` for pending approval count (Debts) and incoming invites+requests (Groups/Friends) — counts fetched in `(app)/layout.tsx`.
- **Header:** `SidebarTrigger` at all breakpoints; brand; right cluster = ⌘K search button, notifications bell (Suspense fallback = disabled bell button, no layout shift), avatar menu. **URL-derived breadcrumbs removed** — breadcrumbs move into PageHeader on detail pages where they can use entity names.

### 5. Per-page redesign

**Dashboard** — split the 768-line client into section components. (a) Banners → "Needs attention" Card: `ItemGroup` rows per pending approval/overdue alert, each linking to `/debts/requests` or the debt. (b) 4 static StatCards. (c) Donut card with `Tabs` ("Owed to you" / "You owe") in its header + `ChartLegend`. (d) "Add debt" opens the shared create-debt Dialog in place (actions already exist). (e) All rows are links; truncation shows "+N more". (f) Tab "Paid" gets undo toast.

**Debts list** — stat cards informational; one toolbar (Tabs direction + Select status + search Input); Table upgraded: sortable Date/Amount headers, person column, row `DropdownMenu` (view / mark paid / modify / delete), rows are Links. CreateDebtModal: friend picker → `Command`-in-`Popover` combobox; reminder section → `Collapsible`.

**Debts requests (inbox)** — rebuilt as the single approval inbox: `Tabs` "Needs your approval" / "Waiting on others"; compact `Item` rows (Avatar, type StatusBadge, amount delta, View debt link, Approve/Reject with AlertDialog on reject + toasts). `/debt-transactions` becomes a `redirect()` to it (route was a duplicate).

**Debt detail** — PageHeader with breadcrumb `Debts / {person}` + right actions (Mark as paid w/ confirm, Request change); pending-request approval promoted to its own Card with Approve/Reject in footer; receipts merged into one side card (upload inside it, Empty when none); reuses the same modify/delete dialogs as the list page; `notFound()` instead of redirect-to-dashboard.

**Groups list** — cards wrapped in Links with member avatars + open-debt/balance line instead of created-date; Invites button → badge-annotated link; PageHeader with single primary "Create group".

**Group detail** — split the 940-line client: PageHeader (breadcrumb `Groups / {name}`, primary "Add debt", `DropdownMenu` for Create with AI / Invite member); StatCard row (You owe / You're owed / Outstanding / Members); all filter pills → `ToggleGroup`; debts list rows → Items with Links + `DropdownMenu` status action; multi-debt wizard Dialog → `Sheet` listing all line-items at once with per-item validation and single receipt slot; borrower picker → Combobox over in-memory `group.members`; invite dialog uses real `Tabs` + `Command` friend picker; Members tab rows → `Item` with Avatar.

**Recurring list** — row toggle moved out of the anchor into a `DropdownMenu`/Switch outside the Link; meta line split into structured slots with cadence; Empty gets CTA Button; create form → `Sheet` with `ToggleGroup` for type and Combobox borrower entry (existing `searchUsers` action).

**Recurring detail** — drop local container; PageHeader (breadcrumb, description-as-title, `$X every N days` + StatusBadge inline, actions cluster with AlertDialog delete); five stacked cards → one summary card (2-col description list) + Borrowers as `ItemGroup` with Avatars; `error.tsx`/`notFound()`.

**Tabs** — real `Tabs` (Borrowing / Lending / Paid); persistent stat row including $0; card grid → `Item` rows with `DropdownMenu` actions + AlertDialog delete + undo toast; create dialog: `ToggleGroup` type selector, fix `toast.error("")` bug, stop per-keystroke rounding; Paid section collapsible with "Clear all".

**Friends** — URL-synced tabs (`?tab=`); "Add friend" → header Dialog (delete the Add tab); Requests badge counts incoming only; Remove → row DropdownMenu + AlertDialog; consistent `Empty` for sub-sections; Accept/Reject order standardized (Reject outline left, Accept right).

**Invites** — same row pattern as friends; discoverable via sidebar badge; consistent person rendering.

**Alerts** — PageHeader (no Back button); consistent Select handling with toasts; recurring rows link to their payment.

**AI** — remove double container and magic heights (flex column filling the viewport under the header); PageHeader with labeled shadcn `Select` group picker; `Empty` no-messages state with suggested prompts; `Empty` + "Create a group" CTA when no groups; lucide icon; `ScrollArea` messages; review bubbles full-width; success message links to the group.

**Auth** — `(auth)` layout centers a `max-w-md` slot; single `AuthForm` (mode login/signup) with FieldError + per-action pending + Spinner; signup gets password-requirement `FieldDescription`. (Forgot-password flow is backend work — deferred, noted.)

**Landing** — moved to `(marketing)` with its own header (brand + Features/How it works/Pricing anchors + auth buttons); `SectionHeader` extracted; how-it-works + pricing checklist rebuilt on `Item`. DebtWeb hero untouched.

## Out of scope

Colors/typography/theming; react-hook-form; TanStack DataTable; forgot-password backend flow; notifications-system changes; any `components/ui/*` edits.

## Verification

`tsc --noEmit`, `next build`, then dev server + Playwright screenshots of every page for a structural self-critique pass.
