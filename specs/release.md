# Broke Besties testing, release, and checklist

How to test the app and backend, ship to TestFlight, and keep CI green (Part A), and the checklist of every feature and task by phase (Part B). Related: [README.md](./README.md), [backend.md](./backend.md), [mobile-app.md](./mobile-app.md).

## Part A: Testing, release (EAS → TestFlight), CI

### A.1 Testing

#### A.1.1 Unit tests (Jest + `jest-expo/ios`): `src/lib/**/*.test.ts`

These are required. They cover all the money math, which must match the web exactly.

| File | Cases |
|---|---|
| `format.test.ts` | `money` thousands/negatives/rounding; `signedMoney` signs; `initials` ("Alex Kim"→"AK", "alex.kim@x.com"→"AK", "a"→"A"); `frequencyLabel` for null/7/14/30/5; `parseMoneyInput` ("$1,234.5"→1234.5, "0"→null, "abc"→null, "12.345"→12.35) |
| `debts.test.ts` | `direction`, `otherParty`, `summarize` counts only pending; `filterDebts` (view × status × search on name/email/description/group); `sortDebts` both keys/dirs; `needsMyApproval` for lender/borrower/requester; `canRequestChange` |
| `balances.test.ts` | Netting A→B vs B→A (partial, exact cancel, reversal); status/view/lender/borrower filters; sort order |
| `chart-series.test.ts` | Copy of `apps/web/src/lib/chart-series.test.ts` (6-month window, zero-filled months, out-of-window items ignored) |
| `recurring.test.ts` | `getNextRenewalDate` (created today, mid-period, exact boundary); `upcomingWithin(7)` inclusive bounds |
| `splits.test.ts` | `buildReceiptAssignments` (one item/one member, one item/three members with rounding, unassigned items skipped, description join); `perMemberTotals`; `splitEvenly(3)` sums to exactly 100; `splitsValid` tolerance ±0.01 |
| `secure-storage.test.ts` | Round-trip 5,000 characters; overwrite a longer value with a shorter one; remove clears all chunks |
| `api/client.test.ts` | Bearer header; JSON vs FormData headers; `{error}` → `ApiError`; 401 → refresh → retry; second 401 → signOut; network failure → status 0; timeout |
| `theme/tokens.test.ts` | Every `--var` in `global.css` equals `tokens.ts` (both schemes) |

#### A.1.2 Component tests (React Native Testing Library): `*.test.tsx`

Render with `renderWithProviders()` (`src/test/render.tsx`: QueryClient with `retry:false`, a fake auth session, the theme). Mock `src/lib/api/endpoints.ts` with `jest.mock`.

| Component / screen | Assertions |
|---|---|
| `AuthForm` | Validation messages (exact web copy); submit disabled while pending; Supabase error shown in the banner; the signup confirmation state |
| `DebtRow` | Sign and tone per direction; swipe actions only when pending; a11y label text |
| `PendingRequestCard` | Approve/Reject shown only to the party who hasn't approved; Cancel only for the requester; drop approval asks for confirmation |
| `ReminderCard` | Lender sees Add/Edit; borrower sees "Only the lender can manage reminders" + opt-out when active |
| `ItemAssignmentRow` + assign screen | "Split all evenly" assigns everyone; totals footer; self excluded from created debts |
| `BorrowerSplitEditor` | % ↔ $ linkage; split evenly; the invalid-sum message |
| `NeedsAttention` | Hidden when empty; row copy for each type |
| `GroupDebtsList` | Segment counts; optimistic status flip + revert on error |
| `new-debt` sheet | Submit order: upload → create → alert; alert failure doesn't fail the flow; receipt deleted if create fails |

Coverage target: ≥ 90% lines in `src/lib`, ≥ 60% overall. `pnpm test --coverage` runs in CI.

#### A.1.3 Contract tests (optional, recommended)
`src/lib/api/contract.test.ts` runs only when `CONTRACT_API_URL` and `CONTRACT_TOKEN` are set (a staging token for the QA user). It calls each GET endpoint and checks the response has the fields `types.ts` expects (a small hand-written zod schema per type). Run it nightly in CI against staging to catch backend drift.

#### A.1.4 E2E (Maestro): `apps/mobile/.maestro/`

Runs against a **preview** or development build on the iOS Simulator, pointed at **staging** with seeded QA accounts.

| Flow file | Steps |
|---|---|
| `01-login.yaml` | Launch → Welcome → "I already have an account" → type QA email/password → "Log in" → assert "Welcome back" |
| `02-create-debt.yaml` | Home → "+" → "Add debt" → pick friend "QA Bob" → amount 12.34 → "Create debt" → assert toast "Debt created" → Debts tab shows "+$12.34" |
| `03-request-approve.yaml` | As Alice: open a debt → "Mark as paid" → confirm. Relaunch as Bob → Debts → Requests (badge 1) → "Approve" → assert the debt shows "Paid" |
| `04-group.yaml` | Groups → "+" → "QA Trip {timestamp}" → Create → "…" → "Invite member" → Email tab → invite → assert toast |
| `05-friends.yaml` | Friends → "+" → email → "Send request" → assert "Friend request sent" or "You are now friends" |
| `06-tabs.yaml` | More → Tabs → "+" → "I lent" → person/amount/description → "Add tab" → "Mark paid" → assert Paid segment count +1 |
| `07-scan.yaml` | Group detail → "…" → "Scan receipt" → "Choose from library" (pre-loaded fixture image via `addMedia`) → wait for "Assign items" → "Split all evenly" → Create → assert toast |
| `08-dark-mode.yaml` | More → Appearance → Dark → screenshot Home/Debts/Group (visual review) |
| `09-logout.yaml` | More → Log out → confirm → assert Welcome |
| `10-paypal.yaml` | (Sandbox only; QA Alice has a connected sandbox PayPal) As Bob: open a debt to Alice → "Pay $X with PayPal" → log in as the sandbox **personal** buyer in the auth browser → Pay → assert the debt shows "Paid" and the Activity row "Paid with PayPal". Maestro can drive the auth browser's web view on iOS; if a PayPal page change makes it flaky, keep this flow manual. |

Test data: add `apps/web/prisma/seed-qa.ts` (script `pnpm seed:qa`). It creates `qa-alice@brokebesties.test` and `qa-bob@brokebesties.test` (Supabase admin `createUser` with passwords from env), makes them friends, puts them in a group "QA House", and adds three pending debts in each direction, one pending `confirm_paid` request from Bob, and one alert with a deadline in the past (so "Overdue" shows). Run it before every E2E run on staging.

#### A.1.5 Manual QA matrix (before each external TestFlight build)

| Device (simulator or real) | Checks |
|---|---|
| iPhone SE (3rd gen): `compact` | No clipped text in tiles/rows; sheets fit; keyboard never covers submit |
| iPhone 17: `regular` | Full smoke of every screen in mobile-app.md Part D |
| iPhone 17 Pro Max | Gutter 20; no stretched charts |
| iPad (A16), portrait + landscape | 2-column Home and Group detail; max-width content; sheets centered |
| Any device + Dark Mode | Every screen; charts use dark palette; no white flashes on sheet/keyboard |
| Dynamic Type AX1 | Rows wrap; tiles stack; header titles truncate cleanly |
| VoiceOver | Log in, create debt, approve request, scan receipt with VoiceOver only |
| Network Link Conditioner "3G" + airplane mode | Skeletons, offline banner, disabled mutations, recovery on reconnect |
| **PayPal (sandbox)** | Connect from Profile (web and iOS); disconnect; pay a debt from iOS with checkout in the auth browser **and** with the PayPal app installed (return through the `paypal/return` fallback route); cancel mid-checkout (nothing charged, debt unchanged); a declined card shows the 402 message; refund the capture in the sandbox dashboard → debt back to pending, both people emailed |
| **Cross-client parity** | For the same QA account, web and mobile show identical numbers on Dashboard/Home, Debts, a Group; a change made on one side appears on the other after a refresh |

### A.2 Build configuration

#### A.2.1 `eas.json`

```json
{
  "cli": { "version": ">= 24.0.0", "appVersionSource": "remote" },
  "build": {
    "base": {
      "node": "22.20.0",
      "pnpm": "10.33.0",
      "ios": { "resourceClass": "default" }
    },
    "development": {
      "extends": "base",
      "developmentClient": true,
      "distribution": "internal",
      "environment": "development",
      "channel": "development",
      "env": { "APP_VARIANT": "development" }
    },
    "development-simulator": {
      "extends": "development",
      "ios": { "simulator": true }
    },
    "preview": {
      "extends": "base",
      "distribution": "internal",
      "environment": "preview",
      "channel": "preview",
      "env": { "APP_VARIANT": "preview" }
    },
    "production": {
      "extends": "base",
      "distribution": "store",
      "environment": "production",
      "channel": "production",
      "autoIncrement": true,
      "env": { "APP_VARIANT": "production" }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "<App Store Connect numeric app id — fill after §A.3 step 2>",
        "appleTeamId": "<10-char Team ID>"
      }
    }
  }
}
```

- **development / development-simulator:** dev client with the dev bundle id; for engineers.
- **preview:** internal (ad hoc) distribution to registered devices against **staging**; for QA before TestFlight. Different bundle id, so it installs next to the TestFlight app.
- **production:** App Store signing; the **only** profile that goes to TestFlight; production backend.
- `appVersionSource: "remote"` + `autoIncrement`: EAS owns `CFBundleVersion` (the build number), so nobody edits it by hand. `version` in `app.config.ts` is the marketing version.

#### A.2.2 Environment variables per EAS environment

| Name | development | preview | production |
|---|---|---|---|
| `EXPO_PUBLIC_API_URL` | LAN / local Next | staging URL | production URL (= `NEXT_PUBLIC_APP_URL`) |
| `EXPO_PUBLIC_SUPABASE_URL` | local / staging | staging | production |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | matching | matching | matching |

All are public (they ship in the JS bundle), so `plaintext` visibility is correct. **Never** put the service-role key, Stripe keys, Resend key, or Google API key in the mobile app.

### A.3 Shipping to TestFlight (step by step)

1. **Apple Developer account** (owner): the membership must be active, with the latest Program License Agreement accepted in App Store Connect → Business. Note the Team ID.
2. **Create the app record** in App Store Connect → Apps → "+" → New App: Platform iOS; Name "Broke Besties" (must be unique on the App Store; if it's taken, use "Broke Besties: Split Bills"); Primary language English (U.S.); Bundle ID `com.brokebesties.app` (register it first under Certificates, Identifiers & Profiles, or let EAS create it during the first build and then pick it here); SKU `brokebesties-ios`. Copy the numeric **Apple ID** of the app into `eas.json` → `submit.production.ios.ascAppId`.
3. **First production build:**
   ```bash
   cd apps/mobile
   eas build --platform ios --profile production
   ```
   EAS asks you to log in with Apple, registers the bundle id, turns on the **Sign in with Apple** capability (from `usesAppleSignIn`), and creates and stores the distribution certificate and provisioning profile. Accept "Let EAS manage credentials".
4. **Submit:**
   ```bash
   eas submit --platform ios --profile production --latest
   ```
   Let EAS create an App Store Connect API key when asked (stored on EAS, reused next time). Later builds can use `eas build -p ios --profile production --auto-submit` to do steps 3 and 4 in one go.
5. **Processing:** 5–30 minutes. Export compliance is answered automatically (`usesNonExemptEncryption: false`).
6. **Internal testing** (no review): App Store Connect → TestFlight → Internal Testing → "+" group "Core team" → add team members (they need an App Store Connect role; up to 100) → turn on automatic distribution. Testers install the **TestFlight** app and accept the email invite.
7. **External testing** (friends / beta users; needs Beta App Review for the first build of each version):
   - TestFlight → Test Information: Beta App Description, Feedback Email, **Privacy Policy URL** (required), Marketing URL (optional).
   - **Sign-in required → demo account:** the QA Alice credentials from §A.1.4 (on production, seed a separate `review@…` account with sample data; never a real person's account).
   - Review notes: "Sign in with the demo account. Google and Apple sign-in are also supported. The app tracks shared expenses; no real money moves in this version."
   - External Testing → "+" group "Beta" → add testers by email or turn on a **public link** (up to 10,000 testers) → add the build → Submit for Review (usually < 24 h).
8. **Each later release:** bump `version` in `app.config.ts` for user-visible releases (1.0.0 → 1.1.0). Build numbers increment automatically. Write "What to Test" in App Store Connect for each build.
9. **Builds expire after 90 days.** Ship at least one build every ~80 days while the beta runs.

### A.4 App Store / TestFlight compliance checklist

| Requirement | How we meet it |
|---|---|
| 4.8 Login services | Sign in with Apple offered alongside Google (S1, S2, S3) |
| 5.1.1(v) Account deletion | Profile → Delete account (S24a + B13) |
| 5.1.1 Privacy policy | URL in App Store Connect + a link on Welcome and Profile (product must publish the page on the web domain) |
| App Privacy "nutrition label" | Data collected, all **linked to the user**, **not used for tracking**, purpose "App Functionality": Contact Info → Name, Email Address; Identifiers → User ID; User Content → Photos (receipts); Financial Info → Other Financial Info (debt amounts, PayPal payment records) and Payment Info (the connected PayPal email and payer ID); add Diagnostics → Crash Data if Sentry is enabled |
| Permission strings | Camera and Photos purpose strings in `app.config.ts` (`expo-image-picker` plugin); no microphone |
| Privacy manifest | `ios.privacyManifests` in `app.config.ts`; Expo modules ship their own manifests |
| 3.1.1 In-App Purchase | No digital goods sold: AI premium and Wallet are hidden in v1 (README §2.2) |
| Export compliance | `usesNonExemptEncryption: false` (HTTPS only) |
| Demo account for review | §A.3 step 7 |
| Age rating questionnaire | No objectionable content; no real gambling; finance tracking only → expected 4+ |
| iPad | `supportsTablet: true`; layouts in mobile-app.md §C.3; screenshots required only for App Store release, not TestFlight |

### A.5 OTA updates (EAS Update)

- `runtimeVersion: { policy: 'fingerprint' }`: an update only reaches builds whose native layer is identical. Changing any native dependency, plugin, or `app.config.ts` native field produces a new fingerprint, so it needs a new build.
- Channels match profiles: `production` builds read the `production` channel.
- Ship a JS-only fix to TestFlight users:
  ```bash
  eas update --channel production --environment production --message "Fix debt sort order"
  ```
- Staged rollout for risky fixes: `eas update ... --rollout-percentage 20`, then `eas update:edit` to widen it.
- `checkAutomatically: 'ON_LOAD'` with `fallbackToCacheTimeout: 0`: the app starts on the cached bundle immediately and applies a downloaded update on the next cold start.
- More → About shows `Updates.updateId` so testers can report which JS they're running.

### A.6 Observability (recommended, Phase 5)

- **TestFlight feedback:** screenshot + comment from testers appears in App Store Connect → TestFlight → Feedback. Crashes are under Crashes.
- **Sentry** (optional but recommended before external testing): `npx expo install @sentry/react-native`, add its Expo config plugin, and set `SENTRY_AUTH_TOKEN` as an EAS secret so source maps upload during build. Tag events with `variant` and `updateId`. Never send request bodies (they contain names and amounts).
- Log (with `console.warn`, which Sentry captures) the "User row missing" case (mobile-app.md §E.2.5) and receipt cleanup failures.

### A.7 CI

#### A.7.1 `.github/workflows/mobile.yml` (new)

```yaml
name: Mobile

on:
  pull_request:
    paths: ["apps/mobile/**", ".github/workflows/mobile.yml"]
  push:
    branches: [main]
    paths: ["apps/mobile/**"]

jobs:
  check:
    name: Typecheck, lint, test
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/mobile
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm test --coverage
      - run: npx expo-doctor

  build-and-submit:
    name: EAS production build → TestFlight
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: check
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/mobile
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "22" }
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: pnpm install --frozen-lockfile
      - run: eas build --platform ios --profile production --non-interactive --no-wait --auto-submit
```

- `EXPO_TOKEN`: an Expo robot/access token stored as a GitHub Actions secret.
- Leave the `build-and-submit` job disabled (comment out the `if` or add `workflow_dispatch` only) until the first manual build in §A.3 has created the credentials.
- The existing `tests.yml` keeps running the web suite on every PR. Phase 0 backend PRs must keep it green.

#### A.7.2 Nightly (optional)
A scheduled workflow runs `contract.test.ts` (§A.1.3) against staging and Maestro flows on EAS Workflows (`.eas/workflows/e2e.yml` with the `maestro` job type) against the latest preview build.

### A.8 Release gate (Phase 5 done = all ticked)

- [ ] Everything in Part B ticked
- [ ] Unit + component tests green; coverage targets met
- [ ] Maestro flows 01–09 green on staging
- [ ] Manual QA matrix (§A.1.5) passed, including cross-client parity
- [ ] Accessibility rules (mobile-app.md §C.9) verified with VoiceOver and AX1
- [ ] Privacy policy URL live; App Privacy answers filled in
- [ ] Demo account seeded on production
- [ ] Production build processed in App Store Connect, internal testers installed and did a smoke test
- [ ] External group submitted for Beta App Review


---

## Part B: Feature checklist

Tick an item only when it works **on a real iPhone against staging** and matches the web for the same account. Section numbers match the phases in the README.

### B.0 Backend prerequisites (`apps/web`, backend.md Part A)

- [ ] B1 `getUser()` accepts `Authorization: Bearer`; cookie path unchanged; tests
- [ ] B2 `handle_new_user` migration (no exception without an OAuth name); applied to staging + prod
- [ ] B3 Receipt access checks awaited; pending-receipt delete/link restricted to uploader; 403/404 mapping; tests
- [ ] B4 `GET/POST /api/tabs`, `PATCH/DELETE /api/tabs/[id]`; tests
- [ ] B5 `POST /api/invites/[id]/reject`, `DELETE /api/invites/[id]`; tests
- [ ] B6 `GET /api/groups/[id]/debts`, `POST /api/groups/[id]/members`; group 404 fix; tests
- [ ] B7 `GET /api/debts/[id]` adds `transactions` + `receiptImageUrls`; shared signed-URL helper
- [ ] B8 `GET /api/friends/search`, `GET /api/friends/recent`; `POST /api/friends` accepts `{ email }`
- [ ] B9 `GET /api/alerts?role=lender`
- [ ] B10 `GET /api/me/counts`
- [ ] B11 `GET /api/dashboard` sharing `getDashboardData()` with the web page
- [ ] B12 `POST /api/recurring-payments` accepts borrower emails
- [ ] B13 `DELETE /api/user` (anonymize + delete auth user; product sign-off on the approach)
- [ ] B14 Supabase redirect URLs + Apple provider (staging, prod, local `config.toml`)
- [ ] B15 Error mapping fixes

#### PayPal (backend.md Part B)
- [ ] Gates G1–G3 confirmed in the sandbox; live eligibility for personal payees confirmed with PayPal (else build the P.9 PayPal.me fallback)
- [ ] Sandbox + live PayPal apps: Log in with PayPal on, return URL set, webhook subscribed; env vars in Vercel
- [ ] Migration `add_paypal` (`PaypalAccount`, `PaypalPayment`, back-relations)
- [ ] `src/lib/paypal.ts` (token cache, fetch wrapper, signed OAuth state) with tests
- [ ] Connect: `GET /api/paypal/connect`, `GET /api/paypal/callback`, `GET/DELETE /api/paypal/account`
- [ ] Pay: `POST /api/debts/:id/paypal/order`, `GET /paypal/return` bridge, `POST /api/paypal/payments/:id/capture`
- [ ] `GET /api/debts/:id` returns the `paypal` block
- [ ] Webhook with required signature verification; all six event types
- [ ] Settlement rules (P.8): amount/payee check, debt paid, alert off, pending requests cancelled, audit transaction, idempotent
- [ ] Refund/reversal path puts the debt back to pending
- [ ] Emails: `paypal-payment-received`, `paypal-payment-refunded`
- [ ] Web UI: Profile PayPal card, "Pay with PayPal" on debt detail, PayPal badge in Activity
- [ ] Security checklist P.11 ticked; service + route tests P.12 green
- [ ] `curl` smoke test with a Bearer token passes on staging and prod

### B.1 Foundation

#### Project
- [ ] Old `apps/mobile` removed; SDK 57 project created; `.npmrc` hoisted; template demo files deleted
- [ ] All packages from mobile-app.md Part A installed; `npx expo install --check` and `expo-doctor` clean
- [ ] `app.config.ts` with 3 variants; `eas.json`; EAS project linked (`62fdb7af-…`); env vars in all 3 EAS environments
- [ ] NativeWind working (Babel + Metro + `global.css` + `tailwind.config.js`); dark mode variables switch
- [ ] Overpass fonts load before the splash hides; no flash of the system font
- [ ] Dev build installed on the simulator and on at least one iPhone
- [ ] ESLint rules (themed `Text`, API client import boundaries), Prettier, `tsc` strict: all clean

#### Design system
- [ ] `tokens.ts` + `global.css` match mobile-app.md Part C (token parity test passes)
- [ ] UI primitives: Text, Button (5 variants, loading), IconButton/HeaderButton (badge), Card, Badge, StatusBadge (web variant map), Input, TextArea, MoneyInput, Field, Avatar, Empty, Skeleton, Spinner, Separator, Segmented, ListRow, SwipeableRow, SectionHeader, StatTile, AnimatedAmount, Banner, FormSheet, SelectMenu, DateField, ChipMultiSelect, Screen, OfflineBanner
- [ ] Charts: AreaChart, DonutChart, BalanceBars render in light and dark
- [ ] `confirm()`, `showActions()`, haptics helpers; reduce-motion respected

#### Data and auth
- [ ] `secureStorage` (chunked Keychain) with tests
- [ ] Supabase client (PKCE, auto-refresh only in the foreground)
- [ ] API client: bearer, JSON/multipart, timeout, 401 refresh-retry-signout; tests
- [ ] `types.ts` + `endpoints.ts` for all 51 endpoints in backend.md Part C
- [ ] QueryClient with focus and online managers; key factory
- [ ] AuthProvider + `Stack.Protected` gating; `queryClient.clear()` on sign-out
- [ ] Email/password log in (web validation copy)
- [ ] Email/password sign up (min 6; the confirmation-pending state)
- [ ] Sign in with Apple (nonce; first-sign-in name saved to profile; cancel is silent)
- [ ] Continue with Google (browser PKCE; cancel is silent)
- [ ] Log out (local scope) with confirmation
- [ ] Session expiry → Welcome + toast
- [ ] Deep link received while signed out is replayed after sign-in

#### Navigation
- [ ] NativeTabs: Home, Debts, Groups, Friends, More with SF Symbols
- [ ] Tab badges from `/api/me/counts` (Debts = requests, Groups = invites, Friends = friend requests); refresh every 60 s and on foreground
- [ ] Large-title headers with header search on Debts/Groups/Friends
- [ ] Detail routes push over the tabs; sheets present with detents and a grabber
- [ ] Custom-scheme deep links open the right screen (`/debts/42`, `/groups/7`, `/invites`, `/debts/requests`)

### B.2 Core money

#### Home (S5)
- [ ] Greeting with the user's name
- [ ] Bell with count → Notifications sheet (approvals + overdue alerts; each row navigates correctly)
- [ ] "+" → Quick add sheet with all 6 actions working
- [ ] Needs attention card (hidden when empty; approval rows → Requests; overdue rows → debt)
- [ ] Stat tiles: You are owed, You owe, Active recurring, Next renewal (numbers match the web)
- [ ] Debt breakdown donut with Owed/Owe toggle, top 4 + Other, legend amounts
- [ ] Upcoming payments (next 7 days, ≤ 3, View all)
- [ ] Activity chart (6 months, 2 series, press-and-hold values)
- [ ] Your groups (≤ 3, View all, empty CTA)
- [ ] Your tabs (≤ 3 active, Mark paid optimistic, empty CTA)
- [ ] Pull-to-refresh; skeletons; error state

#### Debts list (S8)
- [ ] Summary tiles: owed, owe, net, pending requests
- [ ] Segmented All/Lending/Borrowing with counts
- [ ] Status filter (All/Pending/Paid)
- [ ] Sort (date/amount, asc/desc)
- [ ] Header search (name, email, description, group)
- [ ] Row: avatar, name, description · group, date, signed amount, status badge
- [ ] Swipe + "…" actions on pending debts: Mark as paid / Modify / Delete
- [ ] Requests header button with badge
- [ ] Empty states (filtered vs not)

#### Create debt (S11 new-debt)
- [ ] Friend picker: recent friends, search, select, "Add a friend" shortcut
- [ ] Group-member picker when opened from a group
- [ ] Amount validation; optional description; optional group
- [ ] Optional receipt (camera/library, thumbnail, remove)
- [ ] Optional reminder (message, deadline, frequency) created after the debt; its failure doesn't fail the debt
- [ ] Receipt cleaned up if debt creation fails
- [ ] Toast + haptic; lists and Home refresh

#### Debt detail (S9)
- [ ] Hero: amount (signed, tinted), status, direction line, description, group link, created date
- [ ] Mark as paid → confirm-paid request
- [ ] Request change → Modify (only changed fields sent) / Delete request (reason)
- [ ] Actions hidden while a request is pending, with the explanatory note
- [ ] Pending request card: details, approval chips, Approve/Reject (the right party), Cancel (requester), drop-approval confirm, back after deletion
- [ ] Reminder card: lender add/edit/remove; borrower read-only + opt-out
- [ ] Receipts: thumbnails, full-screen viewer (paging, pinch zoom), add receipt
- [ ] Activity timeline
- [ ] Not-found state

#### Requests inbox (S10)
- [ ] Needs your approval / Waiting on others with counts
- [ ] Row details (requester, other party, amount change, new description, reason, approval chips)
- [ ] Approve / Reject with confirms; optimistic removal; badge decrements
- [ ] View debt link; empty states

#### Reminders
- [ ] Create/edit/remove on a debt (lender)
- [ ] Opt-out (borrower)
- [ ] Frequency values exactly Off/7/14/30

### B.3 People

#### Groups list (S13)
- [ ] Group cards (name, member count, avatars)
- [ ] Search
- [ ] Pending-invites banner → Invites
- [ ] Create group sheet → navigates to the new group
- [ ] Live refresh when added to or removed from a group (realtime) and on foreground

#### Group detail (S14)
- [ ] Subtitle (created date, member count)
- [ ] Stats: You owe, You're owed, Outstanding, Members
- [ ] Overview/Members segmented
- [ ] Debt overview: netted balances, view filter, status chips, lender/borrower filter sheet, total
- [ ] Spending over time chart
- [ ] Debts list with All/Pending/Paid counts; Mark as paid/pending (direct PATCH, optimistic, revert on error)
- [ ] Members list with "(you)"
- [ ] Pending invites with Cancel (sender only)
- [ ] Add debts sheet: multiple lines, member picker, total, sequential create, partial failure handling
- [ ] Invite sheet: Friends tab (recent/search, members excluded, Add) and Email tab (Send invite)
- [ ] Scan receipt entry point
- [ ] Empty state; not-found state

#### Invites (S16)
- [ ] List with group, inviter, member count, date
- [ ] Accept → navigates into the group; Reject with confirm
- [ ] Empty state; badge updates

#### Friends (S17, S18)
- [ ] Friends list with search; Remove (confirm)
- [ ] Incoming requests: Accept / Reject (confirm)
- [ ] Sent requests: Cancel
- [ ] Add friend by email; auto-accept message when the other person already sent one
- [ ] Empty states; badge updates

### B.4 Extras

#### Tabs (S20)
- [ ] Stats: You owe, You're owed, Net
- [ ] Borrowing/Lending/Paid segments with counts
- [ ] Row: person, badge (You owe/Owes you/Paid), description, amount, added date
- [ ] Mark paid (optimistic); Delete/Remove with confirm
- [ ] Add tab sheet (I borrowed / I lent, person, amount, description)

#### Recurring payments (S21, S22)
- [ ] List with All/Lending/Borrowing and counts; rows with cadence, status, direction, lender, borrower count, next renewal
- [ ] Activate/Deactivate (lender, optimistic)
- [ ] Create sheet: amount, description, frequency (+ quick chips), For myself/For others, borrower splits with %↔$ link, split evenly, sum validation, optional reminder
- [ ] Detail: details, borrowers and splits, reminder card, Activate/Deactivate, Delete (confirm)

#### Reminders screen (S23)
- [ ] "Alerts you created" with inline frequency changes + View link
- [ ] "Alerts targeting you" (excluding ones you created) with Stop emails
- [ ] Empty states

#### Profile and account (S24)
- [ ] Edit name (Save/Cancel only when changed)
- [ ] Email, member since, user id with copy buttons
- [ ] Log out
- [ ] Delete account (type DELETE, server call, sign-out, toast)
- [ ] Appearance: System/Light/Dark persisted

#### More menu (S19)
- [ ] All links, badges, version + update id, feedback link

#### PayPal (mobile-app.md §E.6)
- [ ] Profile PayPal card: connect in the auth browser, "Connected as {email}" + Verified badge, disconnect with confirm, `in_use` error
- [ ] Debt detail (borrower): "Pay $X with PayPal" only when `paypal.canPay`; "{lender} hasn't connected PayPal yet" otherwise
- [ ] Pay flow stages (creating → checkout → capturing → done/pending), resume an in-progress payment, cancel does nothing
- [ ] `paypal/connected` and `paypal/return` fallback routes work when PayPal hands off to the PayPal app
- [ ] After payment: debt shows Paid everywhere (Debts, Home, group), Activity shows the PayPal badge, lender receives the email
- [ ] PayPal button follows PayPal's brand guidelines

#### Scan receipt (S25, S26)
- [ ] Group selection (remembers the last one); empty-groups state
- [ ] Take photo / choose from library; permission-denied path to Settings
- [ ] HEIC → JPEG compression under 4 MB
- [ ] Upload + parse progress states; parse failure deletes the receipt; zero-items path
- [ ] Assign: edit name/price, add item, per-item member chips, "$x each", split all evenly, clear, unassigned count, per-member totals
- [ ] Self-assignment excluded from debts with "Your share" note
- [ ] Sequential debt creation + receipt link; toast; lands on the group
- [ ] Cancel discards the receipt

### B.5 Polish and ship

- [ ] iPad 2-column layouts; content max width; landscape
- [ ] Compact (iPhone SE) layout pass
- [ ] Dark mode pass on every screen
- [ ] Dynamic Type AX1 pass
- [ ] VoiceOver pass (labels, row summaries, swipe actions as a11y actions, chart summaries)
- [ ] Offline banner + disabled mutations + recovery
- [ ] Haptics on the events in mobile-app.md §C.5
- [ ] App icon (light + dark) and splash
- [ ] Unit, component, and Maestro suites green; coverage met
- [ ] Mobile CI workflow green on PRs
- [ ] Privacy policy URL + App Privacy answers + demo account
- [ ] Production build on TestFlight; internal testers smoke-tested
- [ ] External Beta App Review passed
- [ ] (Optional) Sentry with source maps

### Phase 2 (separate spec later)

- [ ] AI chat (needs a product decision on premium + In-App Purchase)
- [ ] Wallet (after backend withdrawals are fixed; needs an App Store payments review)
- [ ] Push notifications (Expo push tokens table + send on the same events as emails)
- [ ] Universal links (`apple-app-site-association` on the web domain; email links open the app)
- [ ] Forgot password (Supabase reset email + deep link to a set-new-password screen)
- [ ] Persisted query cache for instant offline cold start
