# Broke Besties iOS app + PayPal: technical spec

**Date:** 2026-09-28 (PayPal added 2026-09-29) · **Target:** Expo SDK 57 (React Native 0.86.3, React 19.2.3) · **Ship to:** TestFlight via EAS Build + EAS Submit
**Replaces:** the current `apps/mobile` (Expo SDK 54 template, last touched 2026-01-13, cannot talk to the current backend)
**Backend:** the existing Next.js app in `apps/web` (`/api/*` routes + Supabase Auth/Storage/Realtime + Prisma/Postgres), plus a new PayPal integration

| File | What's in it |
|---|---|
| **README.md** (this file) | Goal, scope, architecture, environments, decisions, phases, bugs found |
| [backend.md](./backend.md) | Part A: backend prerequisites for mobile (B1–B15) · Part B: PayPal connection (P.1–P.13) · Part C: API contract with TS types and client functions |
| [mobile-app.md](./mobile-app.md) | Part A: setup commands and packages · B: project structure and every file · C: design system · D: navigation and every screen (S1–S26) · E: data layer, auth, receipts, realtime, PayPal flow |
| [release.md](./release.md) | Part A: testing, EAS/TestFlight release, App Store compliance, CI · Part B: feature checklist by phase |

References look like `backend.md §P.6` or `mobile-app.md §E.2.4`; screens are `§S9`.

## 1. Goal

An iOS app, distributed through TestFlight, that does everything the web app's finished features do, against the same backend and the same accounts. The design follows iOS conventions, so it differs from the web where the platform calls for it (tab bar instead of sidebar, sheets instead of dialogs, swipe actions instead of table menus), but every feature behaves the same. A user can start a debt on the web, approve the change request on their phone, and see the same state in both places.

## 2. Scope

### 2.1 In v1 (parity with the web)

| Area | Web source | Mobile features |
|---|---|---|
| Auth | `app/(auth)/*`, `api/auth/*` | Email + password sign up and log in, Google, **Apple (new)**, log out, **delete account (new)** |
| Home / dashboard | `app/(app)/dashboard/*` | Needs-attention card, 4 stat tiles, debt breakdown donut, upcoming payments, 6-month activity chart, groups preview, tabs preview with "mark paid" |
| Notifications | `components/notifications-*.tsx` | Bell with count; approvals waiting on you + overdue payment alerts |
| Quick add | `components/command-menu.tsx` (⌘K) | "+" sheet: Add debt, Scan receipt, Create group, Add friend, Add tab, New recurring payment |
| Debts | `app/(app)/debts/*` | List with lending/borrowing/status filters, search, sort, summary tiles; create debt (friend picker, optional group, optional receipt, optional reminder); detail page |
| Debt change requests | `debt-transaction.service.ts`, `debts/requests/*` | Mark as paid / modify / delete as two-party requests; approve / reject / cancel; inbox with "Needs your approval" and "Waiting on others" |
| Reminders (alerts) | `alerts/*`, `debts/[id]/reminder-card.tsx` | Lender adds/edits/removes the reminder on a debt or recurring payment; borrower opts out; Alerts screen with "created by you" and "targeting you" sections |
| Receipts | `api/receipts/*`, `ai/receipt-assignment-panel.tsx` | Attach a receipt photo to a debt; view receipts full screen; **Scan receipt**: parse items with Gemini, assign items to group members, create one debt per person, link the receipt |
| Groups | `app/(app)/groups/*` | List (live updates), create; detail with stats, net-balance chart, spending chart, debts list with filters, mark paid/pending, add several debts at once, members, pending invites (cancel), invite by friend or email |
| Group invites | `app/(app)/invites/*` | Accept / reject, with a badge count |
| Friends | `app/(app)/friends/*` | Friends list, remove; incoming requests (accept/reject); sent requests (cancel); add by email (accepted automatically if they already sent you one) |
| Tabs (IOUs with people who don't have an account) | `app/(app)/tabs/*` | Summary, borrowing/lending/paid filter, add, mark paid, delete |
| Recurring payments | `app/(app)/recurring-payments/*` | List with filters, create (self or others, split %, split evenly, optional reminder), detail, pause/resume, delete |
| Profile | `app/(app)/profile/*` | Edit name, show email / user id (copy), log out |
| Appearance | `components/theme-toggle.tsx` | System / Light / Dark |
| **PayPal (new, web + mobile)** | – (backend.md Part B) | Connect a PayPal account (Log in with PayPal); borrower pays a debt with PayPal Checkout straight to the lender's PayPal; debt marked paid automatically when PayPal confirms the capture |

### 2.2 Not in v1 (and why)

| Feature | Why not | What the app does instead |
|---|---|---|
| AI chat assistant | `/api/agent` is premium-only and there's no way to buy premium. Selling premium on iOS would have to use In-App Purchase (Guideline 3.1.1). | Hidden. Receipt scanning, the non-premium part of the web's AI page, **is** in v1. |
| Wallet (Stripe deposits/withdrawals) | Withdrawals are broken on the backend, and the wallet balance isn't connected to anything. | Hidden. PayPal (above) covers "paying someone back" without holding money. |
| Push notifications | The web sends email only. There's no device-token storage. | Emails keep working. Spec'd for Phase 2. |
| Universal links (email links open the app) | Needs `apple-app-site-association` on the web domain. | Emails open the website. Phase 2. |
| Forgot password | Not built on the web either. | Phase 2 (Supabase `resetPasswordForEmail` + deep link). |
| Android release | The target is TestFlight. | Code stays cross-platform; no Android QA. |

## 3. Architecture

```
┌──────────────────────────── iOS app (apps/mobile) ────────────────────────────┐
│ expo-router screens ──► hooks/queries (TanStack Query) ──► lib/api/client.ts   │
│         │                                                    │ fetch + Bearer │
│         │ supabase-js (auth session, realtime) ◄─────────────┘ token          │
└─────────┼──────────────────────────────────────────────────────┼──────────────┘
          │ HTTPS (JWT refresh, OAuth PKCE,                       │ HTTPS  /api/*
          │ Apple id-token, Realtime WS)                          ▼
┌─────────▼──────────────┐                     ┌──────────────── apps/web (Vercel) ───────────────┐
│ Supabase               │◄── getUser(jwt) ────│ route handler → getUser() (Bearer OR cookie)      │
│  Auth (users, JWT)     │                     │   → services/*.service.ts → policies → Prisma     │
│  Storage "receipts"    │◄── signed URLs ─────│   → emailService (Resend)                         │
│  Realtime (GroupMember)│                     │   → Gemini (receipt parsing)                      │
│                        │                     │   → PayPal REST (OAuth, Orders v2, webhooks)     │
│  Postgres ◄────────────┼──── Prisma ─────────│                                                   │
└────────────────────────┘                     └───────────────────────────────────────────────────┘
```

**Rules**

1. The app **never** talks to Postgres directly (no PostgREST queries), except for one Realtime subscription on `GroupMember`, which RLS already scopes to the user's own rows (`migrations/20260618000002_groupmember_rls`).
2. The app **never** holds the service-role key or any PayPal credential; PayPal checkout and login open in the system auth browser, and money moves borrower → lender inside PayPal (Broke Besties never holds funds). Receipt image URLs come from the API as signed URLs that expire after one hour.
3. All business rules (who can approve what, validation, emails) stay in `apps/web/src/services`. Mobile adds no rules of its own; it only does client-side validation for form feedback.
4. The API is the contract. Mobile types in `apps/mobile/src/lib/api/types.ts` are written by hand from backend.md Part C. The backend doesn't publish them, because the web types come from Prisma.
5. Money is `number` dollars (Prisma `Float`) on the wire, rounded to 2 decimals for display. The UI rounds with `Math.round(x * 100) / 100`, the same as the web's `round2`.

## 4. Environments

| Variant | Bundle id | Scheme | API base (`EXPO_PUBLIC_API_URL`) | Supabase |
|---|---|---|---|---|
| development | `com.brokebesties.app.dev` | `brokebesties-dev` | `http://<LAN-IP>:3000` (device) or `http://localhost:3000` (simulator) | local (`supabase start`) or staging |
| preview | `com.brokebesties.app.preview` | `brokebesties-preview` | Vercel preview/staging URL | staging project |
| production | `com.brokebesties.app` | `brokebesties` | production URL (same as `NEXT_PUBLIC_APP_URL`) | production project |

All three variants can be installed side by side. `app.config.ts` chooses the values from `APP_VARIANT` (mobile-app.md §B.2).

## 5. Non-functional requirements

| Requirement | Target |
|---|---|
| Cold start to usable Home (signed in, warm cache) | < 2.0 s on iPhone 12 |
| Screen data after navigation (cache hit) | Instant, with a background refetch |
| Screen data (cache miss) | Skeleton within 100 ms, content usually < 1 s |
| Frame rate | 60 fps scrolling (120 on ProMotion); no JS work on the scroll path |
| Accessibility | VoiceOver labels on every control, 44×44 pt hit targets, Dynamic Type up to AX1 without clipping, WCAG AA contrast |
| Offline | Cached data stays visible, marked "Offline". Mutations are blocked with a toast; there's no offline queue in v1 |
| Security | Tokens in the iOS Keychain (`expo-secure-store`); no secrets in the bundle except the public Supabase anon key; ATS on (HTTPS only in preview/production) |
| Crash-free sessions | ≥ 99.5% on TestFlight (EAS/Xcode Organizer crash reports) |

## Decision log

These are settled. Re-open one only with a reason the doc didn't consider.

| ID | Decision | Why |
|---|---|---|
| D1 | **Rebuild `apps/mobile` from scratch** on Expo SDK 57. Keep only the EAS `projectId` (`62fdb7af-c55f-4929-a04a-0a999a0c13d0`) and `owner` (`oskip123`) from the old `app.json`. | The old app is SDK 54, uses endpoints that no longer exist (`/api/auth/me`, `/api/receipts?groupId=`), and sends Bearer tokens the backend ignores. Porting would take longer than starting over. |
| D2 | **Auth on the device through `supabase-js`**. Every API call sends `Authorization: Bearer <access_token>`, and `getUser()` in `apps/web/src/lib/supabase.ts` learns to accept it. | The backend's `getUser()` only reads cookies today, so every mobile call returns 401. Supabase already issues JWTs, so no new auth system is needed. |
| D3 | **Mobile calls REST routes only.** Features the web does through server actions get new REST routes (tabs, invite reject/cancel, add friend to group, friend search, group debts, and others). | React Native can't call Next.js server actions. |
| D4 | **Styling: NativeWind 4.2 + Tailwind 3.4**, with tokens mirroring `apps/web/src/app/globals.css`, converted to hex. | Class names read like the web code, so porting a screen is mostly layout work. NativeWind 5 is still a release candidate. React Native has no OKLCH support. |
| D5 | **Navigation: expo-router 57** with `NativeTabs` (a real iOS tab bar with SF Symbols and native badges). Create and edit flows open as native `formSheet` modals. | Looks and behaves like iOS, including Liquid Glass on iOS 26. The tab layout sits in one file, so swapping to JS `Tabs` is a one-file change if the `unstable-` API breaks. |
| D6 | **Server state: TanStack Query v5.** There's no global client store. UI state stays local. | Caching, pull-to-refresh, refetch on focus, optimistic updates, and one invalidation map. |
| D7 | **Charts: victory-native 42 + @shopify/react-native-skia.** | GPU-drawn area and pie charts that support the web's two chart types. |
| D8 | **v1 scope = every web feature rated complete, plus Recurring payments.** The AI chat and the Wallet are Phase 2. | Recurring payments have finished UI and REST. AI chat is premium-gated with no way to buy premium (on iOS that would have to be In-App Purchase). Wallet withdrawals are broken on the backend. |
| D9 | **Sign in with Apple is required in v1.** | App Store Guideline 4.8: an app that offers Google login must also offer Apple login. |
| D10 | **In-app account deletion is required before App Store release**, and ships in v1. | App Store Guideline 5.1.1(v). |
| D11 | **iOS only for v1** (iPhone first, iPad supported with wider layouts). Android must still compile but gets no QA. | The target is TestFlight. |
| D12 | Bundle id **`com.brokebesties.app`** (`.dev` / `.preview` suffixes for other variants). URL scheme **`brokebesties`** (`-dev` / `-preview`). | Placeholders. The Apple Developer account owner must confirm them before the first build. |
| D13 | Receipt scanning on mobile is a **dedicated "Scan receipt" flow** (camera → items → assign → debts), not a chat. | On the web, receipt scanning lives inside the AI page but doesn't need premium. Mobile keeps that non-premium path and drops the chat. |
| D14 | **PayPal settles debts person-to-person** (Orders v2 with the lender as payee), not through a platform balance. Connect uses Log in with PayPal. There's a PayPal.me fallback if live eligibility isn't confirmed (backend.md §P.2). | Money never touches our accounts, so no money-transmitter or wallet complexity, and no platform fees. The capture proves payment, so no two-party confirmation is needed. |

## Phases

| Phase | Deliverable | Gate |
|---|---|---|
| 0: Backend | backend.md Part A (and Part B PayPal backend + web UI, which can run in parallel) merged and deployed | `pnpm test` green; `curl` with a Bearer token returns 200 on `/api/user` |
| 1: Foundation | App shell, design system, auth (email, Apple, Google), API client, navigation skeleton | Can sign in on a simulator and see an empty Home |
| 2: Core money | Home, Debts list/detail, requests inbox, all debt mutations, reminders | release.md checklist §B.2 ticked |
| 3: People | Groups, group detail and charts, invites, friends | release.md checklist §B.3 ticked |
| 4: Extras | Tabs, Recurring, Alerts, Profile, account deletion, receipt scanning, **PayPal connect + pay** | release.md checklist §B.4 ticked |
| 5: Polish and ship | Accessibility pass, iPad layouts, Maestro E2E, EAS production build, TestFlight internal, then external | release.md §A.8 release gate ticked |
| Phase 2 (later) | AI chat, Wallet, push notifications, universal links, forgot password | Separate spec |

## Out-of-scope bugs found while writing this spec

These are in `apps/web`. The first three are fixed in Phase 0 (backend.md Part A) because mobile depends on them; the fourth was fixed alongside them (the Stripe webhook now returns 500 without `STRIPE_WEBHOOK_SECRET` and 400 without a signature).

- `receipt.service.ts` calls the async `canAccessReceipt()` without `await` (lines 151 and 181). A Promise is always truthy, so the access check never denies. Any signed-in user can read or re-parse any receipt whose id they know.
- The `handle_new_user` trigger raises an exception when an OAuth user has metadata but no name. Sign in with Apple doesn't put the name in its token, so every new Apple account would fail to be created.
- `GET /api/groups/[id]` returns 500 instead of 404 for a missing group or a non-member, because the service's error message doesn't match the route's exact-string check.
- The Stripe webhook (`api/stripe/webhook/route.ts`) processes **unsigned** events when `STRIPE_WEBHOOK_SECRET` is missing. The new PayPal webhook must not copy this (backend.md §P.7); fix Stripe's the same way.
