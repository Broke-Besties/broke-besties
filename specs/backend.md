# Broke Besties backend spec (`apps/web`)

Everything the website's backend needs for the iOS app: prerequisites (Part A), the new PayPal connection (Part B), and the full API contract the app codes against (Part C). All new routes follow the existing pattern: `getUser()` → 401 if null → call a service → map known error messages to status codes → `NextResponse.json`.

## Part A: Backend prerequisites (Phase 0)

The app can't work until these land. Every item lists the file, the change, and the tests. All new routes follow the existing pattern: `getUser()` → 401 if null → call a service → map known error messages to status codes → `NextResponse.json`. All new tests go in `apps/web/src/app/api/*.test.ts` and use the mocks in `src/test/mocks.ts` (see `api-routes.test.ts` for the pattern: `vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }))`).

Order matters only for B1 (everything else depends on it). The rest can land in any order, one PR each or grouped.

| ID | Change | Needed by (mobile) | Size |
|---|---|---|---|
| B1 | Accept `Authorization: Bearer <jwt>` in `getUser()` | Everything | S |
| B2 | Apple-safe `handle_new_user` trigger | Sign in with Apple | S |
| B3 | Fix receipt access checks (missing `await`) | Receipts (security) | S |
| B4 | Tabs REST (`/api/tabs`, `/api/tabs/[id]`) | Tabs screen, Home tabs card | M |
| B5 | Invite reject + cancel routes | Invites screen, group members | S |
| B6 | Group debts, add friend to group, fix 404 mapping | Group detail | S |
| B7 | Debt detail includes transactions + receipt image URLs | Debt detail | S |
| B8 | Friend search, recent friends, add friend by email | Friend pickers, Add friend | S |
| B9 | `GET /api/alerts?role=lender` | Alerts screen | XS |
| B10 | `GET /api/me/counts` | Tab badges | XS |
| B11 | `GET /api/dashboard` | Home | S |
| B12 | Recurring create accepts borrower emails | New recurring sheet | XS |
| B13 | `DELETE /api/user` (account deletion) | Profile (App Store 5.1.1(v)) | M |
| B14 | Supabase Auth config: redirect URLs, Apple provider | Google + Apple sign-in | Config |
| B15 | Error-message → status fixes found along the way | Correct error UI | XS |

---

### B1: Bearer-token auth in `getUser()`

**File:** `apps/web/src/lib/supabase.ts`

Today `getUser()` reads only the Supabase cookie. Add a Bearer path that runs first. Keep the cookie path unchanged so the web keeps working.

```ts
import { headers } from 'next/headers'
import { createClient as createJsClient } from '@supabase/supabase-js'

// One stateless client for verifying mobile JWTs (no session, no refresh).
const tokenVerifier = createJsClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
)

async function getBearerToken(): Promise<string | null> {
  try {
    const value = (await headers()).get('authorization')
    if (!value || !/^bearer\s+/i.test(value)) return null
    return value.replace(/^bearer\s+/i, '').trim() || null
  } catch {
    return null // called outside a request scope
  }
}

export async function getUser() {
  const token = await getBearerToken()
  if (token) {
    const { data: { user }, error } = await tokenVerifier.auth.getUser(token)
    return error || !user ? null : user
  }

  // Existing cookie path, unchanged
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}
```

Notes:
- `/api/cron/alert-reminders` also uses `Authorization: Bearer <service-role-key>` but never calls `getUser()`, so it's unaffected.
- A bad or expired token returns `null` → the route returns 401 → the mobile client refreshes the session once and retries (mobile-app.md §E.3).
- Later optimization (not required): verify locally with `supabase.auth.getClaims(token)` when the project uses asymmetric JWT signing keys, which saves a round trip to Supabase per request.
- Native `fetch` has no CORS, so no CORS headers are needed.

**Tests** (`src/lib/supabase.test.ts`, new): mock `next/headers` and `@supabase/supabase-js`:
1. Valid bearer → returns the user and never touches cookies.
2. Invalid bearer → `null`.
3. No header → falls back to the cookie client.
4. Header `bearer` in lowercase is accepted.

---

### B2: Apple-safe `handle_new_user` trigger

**Problem:** `prisma/migrations/20251215043847_fix_auth_trigger_add_name/migration.sql` raises `OAuth user missing name in metadata` when `raw_user_meta_data` is non-empty but has no `full_name`/`name`. A native Sign in with Apple id token carries `iss`, `sub`, `email`, `provider_id` and so on, but never the name. So every first-time Apple sign-in fails with a 500 from Supabase Auth.

**File:** new migration `apps/web/prisma/migrations/20260928000000_handle_new_user_allow_missing_name/migration.sql`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
BEGIN
  user_name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name'
  )), '');

  -- Apple (and email/password) sign-ups have no name: fall back to the email prefix.
  -- The app PATCHes /api/user with the Apple-provided name right after first sign-in.
  IF user_name IS NULL THEN
    user_name := SPLIT_PART(COALESCE(NEW.email, 'user'), '@', 1);
  END IF;

  INSERT INTO public."User" (id, email, name, "createdAt", "updatedAt")
  VALUES (NEW.id, NEW.email, user_name, NOW(), NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Deploy: `npx prisma migrate deploy` (the Production Deployment workflow already runs this on push to `main`).

**Mobile follow-up:** after the first Apple sign-in, if `credential.fullName` has a given or family name, call `PATCH /api/user { name }` (mobile-app.md §E.2.3).

**Heads-up for product:** Apple users who choose "Hide My Email" get a `…@privaterelay.appleid.com` address. Group invites and friend requests match on **email**, so friends must invite that relay address. The Profile screen shows the account email with a copy button so users can share it.

---

### B3: Fix receipt access checks

**File:** `apps/web/src/services/receipt.service.ts`

1. Lines 151 and 181: `if (!this.canAccessReceipt(userId, receipt))` → `if (!(await this.canAccessReceipt(userId, receipt)))`.
2. `deleteReceipt`: pending receipts (`debts.length === 0`) can currently be deleted by anyone. Add `if (receipt.debts.length === 0 && receipt.uploaderId && receipt.uploaderId !== userId) throw new Error('Access denied')`.
3. `linkReceiptToDebts`: also require `receipt.uploaderId === userId || ReceiptPolicy.canView(userId, receipt-with-debts)`, so nobody can attach someone else's receipt to their own debt and then read it.
4. Route mapping: `PATCH/DELETE /api/receipts/[id]` return 500 for everything. Map `'Receipt not found'` → 404 and messages starting with `'Access denied'` → 403.

**Tests** (`src/services/receipt.service.test.ts`, new): user A uploads; user B calling `getReceiptItems`, `parseReceiptItems`, `deleteReceipt`, and `linkReceiptToDebts` → each throws `Access denied`; user A succeeds.

---

### B4: Tabs REST

Tabs have no REST routes today (the web uses server actions in `app/(app)/tabs/actions.ts`). Add two route files that call `tabService`, the same service the actions use.

**`apps/web/src/app/api/tabs/route.ts`**

| Method | Body / query | Service call | Success | Errors |
|---|---|---|---|---|
| GET | `?status=lending\|borrowing\|paid` (optional) | `tabService.getUserTabs(user.id, { status })` | `200 { tabs: Tab[] }` | 401 |
| POST | `{ amount: number, description: string, personName: string, status?: 'lending'\|'borrowing' }` | `tabService.createTab({ ...body, userId: user.id, status: body.status ?? 'borrowing' })` | `201 { tab }` | 400 for `Valid amount is required`, `Description is required`, `Person name is required`, `Invalid status value`; 401 |

**`apps/web/src/app/api/tabs/[id]/route.ts`**

| Method | Body | Service call | Success | Errors |
|---|---|---|---|---|
| PATCH | `{ amount?, description?, personName?, status?: 'lending'\|'borrowing'\|'paid' }` | `tabService.updateTab(id, user.id, body)` | `200 { tab }` | 400 invalid id / `Amount must be positive` / `Description cannot be empty` / `Person name cannot be empty` / `Invalid status value`; 403 `You don't have permission to update this tab`; 404 `Tab not found` |
| DELETE | none | `tabService.deleteTab(id, user.id)` | `200 { message: 'Tab deleted successfully' }` | 403 `You don't have permission to delete this tab`; 404 `Tab not found` |

**Tests:** one happy path and one error mapping per method (mock `tabService`).

---

### B5: Invite reject and cancel

**`apps/web/src/app/api/invites/[id]/reject/route.ts`**: `POST` → `inviteService.rejectInvite(user.email!, id)` → `200 { message: 'Invite rejected' }`. Errors: 404 `Invite not found`; 403 `You can only reject invites sent to you`.

**`apps/web/src/app/api/invites/[id]/route.ts`**: `DELETE` → `inviteService.cancelInvite(user.id, id)` → `200 { message: 'Invite cancelled' }`. Errors: 404 `Invite not found`; 403 `You can only cancel invites you sent`.

Both: 400 when the id isn't an integer.

---

### B6: Group debts, add friend to group, 404 fix

**`apps/web/src/app/api/groups/[id]/debts/route.ts`**: `GET` → `debtService.getGroupDebts(groupId, user.id)` → `200 { debts }`. Errors: 403 `You must be a member of the group to view its debts`.

**`apps/web/src/app/api/groups/[id]/members/route.ts`**: `POST { friendUserId: string }` → `inviteService.createInviteAsFriend(user.id, groupId, friendUserId)` → `201 { member }`. Errors: 400 `Group ID and friend user ID are required` / `You can only add friends directly to a group` / `User is already a member of this group`; 403 `You are not a member of this group`; 404 `User not found`.

**Fix `apps/web/src/app/api/groups/[id]/route.ts`:** the service throws `"Group not found or you are not a member of this group"`, but the route only matches `'Group not found'` exactly, so it returns 500. Change to `if (message.startsWith('Group not found')) status = 404`.

---

### B7: Debt detail includes transactions and receipt images

The web page `app/(app)/debts/[id]/page.tsx` loads the debt, its transaction history, and signed receipt URLs on the server. `GET /api/debts/[id]` returns only the debt.

1. Move the signed-URL loop from `page.tsx` into `receiptService.getSignedImageUrls(receiptIds: string[]): Promise<{ id: string; url: string }[]>` (1-hour expiry, path `receipts/{id}`, skip failures), and use it from both places.
2. Change `GET /api/debts/[id]` to return (adding fields, nothing removed):

```jsonc
{
  "debt": { /* unchanged: debt + lender + borrower + group + receipts + alert */ },
  "transactions": [ /* debtTransactionService.getDebtTransactions(debtId, user.id) */ ],
  "receiptImageUrls": [ { "id": "ck…", "url": "https://…signed…" } ]
}
```

---

### B8: Friend search, recent friends, add by email

**`apps/web/src/app/api/friends/search/route.ts`**: `GET ?q=` → `friendService.searchFriends(user.id, q)` → `200 { friends }` (same shape as `GET /api/friends`: `Friend & { friend: User }`). An empty `q` returns `[]`.

**`apps/web/src/app/api/friends/recent/route.ts`**: `GET ?limit=5` (clamp 1–20) → `friendService.getRecentFriends(user.id, limit)` → `200 { friends }`.

**Change `POST /api/friends`:** accept either `{ recipientId }` (existing) or `{ email }`. With `email`, look up `prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })` the way the web's `sendFriendRequestByEmail` action does; 404 `User not found` if missing; then call `sendFriendRequest`. The response is unchanged (`{ message, friend, autoAccepted }`).

---

### B9: Lender alerts

**Change `GET /api/alerts`:** read `?role=`. `lender` → `alertService.getActiveAlertsForLender(user.id)`; anything else (default) → `getActiveAlertsForBorrower` (current behavior, so nothing that calls it today breaks). Response is still `{ alerts }`.

---

### B10: Badge counts

**`apps/web/src/app/api/me/counts/route.ts`**: `GET` → `getNavCounts(user.id, user.email ?? '')` from `src/lib/nav-counts.ts` → `200 { debtRequests, invites, friendRequests }`.

---

### B11: Dashboard aggregate

Home needs 7 queries. On a phone network, one request is much faster than seven.

**`apps/web/src/app/api/dashboard/route.ts`**: `GET` runs the same `Promise.all` as `app/(app)/dashboard/page.tsx` and returns:

```jsonc
{
  "user": { "id": "…", "email": "…", "name": "…" },
  "debts": [ /* debtService.getUserDebts(user.id, { status: 'pending' }) */ ],
  "groups": [ /* groupService.getUserGroups(user.id) */ ],
  "tabs": [ /* tabService.getUserTabs(user.id) */ ],
  "recurringPayments": [ /* recurringPaymentService.getUserRecurringPayments(user.id, { status: 'active' }) */ ],
  "alerts": [ /* alertService.getActiveAlertsForBorrower(user.id) */ ],
  "pendingApprovals": [ /* getUserPendingTransactions filtered: debt.lenderId === user.id && !lenderApproved */ ],
  "counts": { "debtRequests": 0, "invites": 0, "friendRequests": 0 }
}
```

Refactor so `page.tsx` and this route share one function (`src/lib/dashboard-data.ts: getDashboardData(user)`). That way they can't drift apart.

---

### B12: Recurring create by email

**Change `POST /api/recurring-payments`:** each borrower may be `{ userId, splitPercentage }` (existing) **or** `{ email, splitPercentage }`. Resolve emails server-side the way the web action does (`User with email ${email} not found` → 404; the route's existing `message.includes("not found")` check already maps it). The service already rejects splits that don't sum to 100% (400 `Split percentages must sum to 100%`), so there's nothing to add there.

---

### B13: Account deletion

App Store Guideline 5.1.1(v) requires in-app account deletion for any app that lets users create accounts.

**Caution:** every relation to `User` in `schema.prisma` uses `onDelete: Cascade`, including `Debt.lender` and `Debt.borrower`. A hard delete would also delete **the other person's** debts, transactions, and alerts involving this user.

**Recommended (product owner to confirm):** anonymize instead of hard-delete.

**`apps/web/src/app/api/user/route.ts` → `DELETE`**
1. In one Prisma transaction:
   - `user.update({ name: 'Deleted user', email: 'deleted+<id>@users.brokebesties.invalid' })`
   - delete their pending `Friend` rows, pending `GroupInvite` rows they sent, and their `GroupMember` rows (they leave all groups)
   - delete their `Tab` rows (private to them)
   - set `isActive=false` on `Alert` rows where they are lender or borrower
   - cancel pending `DebtTransaction` rows they requested
   - delete receipts they uploaded that aren't linked to any debt (DB rows + storage objects)
2. `createAdminClient().auth.admin.deleteUser(user.id)`. This deletes the auth identity, so the email and Apple/Google identity can sign up again later.
3. Return `200 { message: 'Account deleted' }`.

Debts they were part of stay visible to the other person, showing "Deleted user".

**Tests:** transaction called with the expected operations; admin `deleteUser` called; 401 without a user.

---

### B14: Supabase configuration (dashboard; not code)

Do this in **each** Supabase project (staging, production). Mirror it in `apps/web/supabase/config.toml` for local dev.

1. **Auth → URL Configuration → Redirect URLs.** Add:
   - `brokebesties://auth/callback`
   - `brokebesties-preview://auth/callback`
   - `brokebesties-dev://auth/callback`
   - `exp+mobile://**` (dev-client deep links while developing)
2. **Auth → Providers → Apple:** enable it. **Client IDs:** `com.brokebesties.app,com.brokebesties.app.preview,com.brokebesties.app.dev`. The native id-token flow doesn't need the Services ID secret key. Only web Apple login would, and the web doesn't have it.
3. **Auth → Providers → Google:** already enabled for the web. Nothing to add, because mobile uses the same OAuth redirect flow through the system browser (mobile-app.md §E.2.4).
4. **Email confirmations:** the app handles both cases. If "Confirm email" is on, sign-up shows a "Check your inbox" state.
5. Local `config.toml`:

```toml
[auth]
additional_redirect_urls = ["http://127.0.0.1:3000", "http://localhost:3000",
  "brokebesties-dev://auth/callback", "exp+mobile://**"]

[auth.external.apple]
enabled = true
client_id = "com.brokebesties.app.dev"
secret = ""
```

---

### B15: Error mapping fixes found along the way

| Route | Now | Fix |
|---|---|---|
| `GET /api/groups/[id]` | 500 for a missing group or non-member | 404 (see B6) |
| `PATCH/DELETE /api/receipts/[id]` | 500 for everything | 404 / 403 (see B3) |
| `GET /api/friends/*`, `GET /api/invites`, `GET /api/debt-transactions` | 500 hides the message | Keep 500 but log the error; no contract change |
| `POST /api/debt-transactions` | 400 for "Debt not found" | 404 when the message is `Debt not found` |

### Web behaviors mobile copies as-is (not fixed here; listed so nobody "fixes" them only on mobile)

1. **Group screen "Mark as paid/pending"** calls `PATCH /api/debts/[id] { status }` directly, and **either** party is allowed to (`DebtPolicy.canUpdate`). The Debts screen, by contrast, uses the two-party `confirm_paid` request. Mobile does the same as the web in each place. If product wants one rule everywhere, change both clients together.
2. `POST /api/invites` checks for an existing invite by exact email and doesn't lowercase it. Mobile lowercases and trims emails before sending.
3. `DELETE /api/friends/[id]` tries remove, then cancel, then reject, in that order. Mobile always uses this one endpoint for all three actions.

### Definition of done for Phase 0

- [ ] B1–B13 merged; `pnpm test` and `npx tsc --noEmit` clean in `apps/web`
- [ ] Deployed to staging and production (migration applied)
- [ ] B14 applied in both Supabase projects
- [ ] Smoke test from a terminal with a real token:
  ```bash
  TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" -H 'Content-Type: application/json' \
    -d '{"email":"test@example.com","password":"password123"}' | jq -r .access_token)
  curl -s "$API_URL/api/user" -H "Authorization: Bearer $TOKEN" | jq .
  curl -s "$API_URL/api/dashboard" -H "Authorization: Bearer $TOKEN" | jq '.counts'
  ```


---

## Part B: PayPal connection (sections P.1–P.13)

### P.1 What it does

1. **Connect PayPal.** Any user can link a PayPal account from Profile, on web or mobile, using "Log in with PayPal" (OAuth 2.0 / OpenID Connect). We store only their PayPal **payer ID** and **verified email**. We never see or store PayPal passwords, cards, or balances.
2. **Pay with PayPal.** On a pending debt, the **borrower** taps "Pay $X with PayPal". PayPal Checkout opens with the amount already filled in and the **lender's connected PayPal account as the recipient**. The borrower approves and the payment is captured, so the money goes straight from borrower to lender on PayPal. Broke Besties never holds the money.
3. **Debt marked paid automatically.** When PayPal confirms the capture, the debt becomes `paid` without the usual two-party `confirm_paid` request. PayPal's capture is the proof. An approved `confirm_paid` transaction is written as an audit record so it shows in the debt's Activity, and the lender gets an email.

Out of scope for this spec: partial payments, platform fees, refunds started from our app (refunds and reversals made in PayPal are handled, see P.8), paying tabs (tabs are with people who have no account), and PayPal for recurring payments. The Stripe wallet is unrelated and stays as it is.

### P.2 Feasibility gates (confirm in the PayPal sandbox and with PayPal before building the UI)

| Gate | Why it matters | Fallback if it fails |
|---|---|---|
| **G1: Orders v2 "pay another account"** (`purchase_units[].payee.merchant_id` / `email_address`) works from our REST app to **personal** PayPal accounts in live mode, without joining PayPal's partner/multiparty program. | PayPal documents a `payee` override on orders. Multiparty/marketplace features (platform fees, seller onboarding) need partner approval. We use no fees and no onboarding, but live eligibility for personal receivers must be confirmed with PayPal before launch. | Use P.9 (PayPal.me deep link + normal `confirm_paid`). The same "Connect PayPal" step still applies. |
| **G2: Log in with PayPal returns `payer_id` and a verified email** for our app (Identity API, scopes `openid email https://uri.paypal.com/services/paypalattributes`). | We need `payer_id` as the payee and a verified email to show. The PayPal app dashboard may require "Log in with PayPal" to be enabled and advanced attributes to be reviewed. | Ask for the email scope only, and pay the lender by `payee.email_address` (verified email). |
| **G3: Return URLs** must be `https://`. | Checkout can't redirect straight to `brokebesties://`. | Already handled: an https bridge route on our domain redirects to the app scheme (P.6). |

App Store note: paying back a friend is a real-world person-to-person payment, not a digital good, so In-App Purchase doesn't apply (the same situation as Venmo and PayPal's own app). The checkout opens in the system auth browser (`ASWebAuthenticationSession`), not in a hidden web view.

### P.3 Environment variables (`apps/web/.env`, Vercel, `sample.env`)

```bash
# PAYPAL (debt settlement)
PAYPAL_ENV=sandbox                 # sandbox | live
PAYPAL_CLIENT_ID=...               # REST app credentials (developer dashboard → Apps & Credentials)
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...              # id of the webhook subscribed in P.7 (needed for signature verification)
PAYPAL_STATE_SECRET=...            # 32+ random bytes; HMAC key for OAuth `state`
```

| | Sandbox | Live |
|---|---|---|
| REST API base | `https://api-m.sandbox.paypal.com` | `https://api-m.paypal.com` |
| Log in with PayPal authorize page | `https://www.sandbox.paypal.com/signin/authorize` | `https://www.paypal.com/signin/authorize` |

In the PayPal app settings: turn on **Log in with PayPal**, set the return URL to `{NEXT_PUBLIC_APP_URL}/api/paypal/callback`, and request the attributes **email** and **PayPal account ID (payer ID)**.

### P.4 Data model (new migration `20260929000000_add_paypal`)

```prisma
model PaypalAccount {
  id            String   @id @default(cuid())
  userId        String   @unique
  payerId       String   @unique          // PayPal payer_id (merchant_id when used as payee)
  email         String                   // primary email from PayPal
  emailVerified Boolean  @default(false)
  connectedAt   DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model PaypalPayment {
  id            String    @id @default(cuid())   // also sent as PayPal-Request-Id and custom_id
  debtId        Int?
  payerUserId   String                            // borrower
  payeeUserId   String                            // lender
  payeePayerId  String                            // lender's PayPal payer_id at order time
  amountCents   Int
  currency      String    @default("USD")
  orderId       String    @unique                 // PayPal order id
  captureId     String?   @unique
  status        String    @default("CREATED")     // CREATED | APPROVED | COMPLETED | CANCELLED | FAILED | REFUNDED
  failureReason String?
  platform      String    @default("web")        // web | ios: where /paypal/return redirects
  returnScheme  String?                           // allow-listed app scheme (brokebesties[-preview|-dev]) for iOS returns
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  completedAt   DateTime?

  debt  Debt? @relation(fields: [debtId], references: [id], onDelete: SetNull)
  payer User  @relation("PaypalPaymentPayer", fields: [payerUserId], references: [id], onDelete: Cascade)
  payee User  @relation("PaypalPaymentPayee", fields: [payeeUserId], references: [id], onDelete: Cascade)

  @@index([debtId])
  @@index([payerUserId])
  @@index([status])
}
```
Add the back-relations on `User` (`paypalAccount PaypalAccount?`, `paypalPaymentsMade PaypalPayment[] @relation("PaypalPaymentPayer")`, `paypalPaymentsReceived PaypalPayment[] @relation("PaypalPaymentPayee")`) and on `Debt` (`paypalPayments PaypalPayment[]`). Money is stored in cents, the same as the Stripe wallet. `Debt.amount` stays a Float, converted with `Math.round(amount * 100)`.

### P.5 Code layout

| File | Contents |
|---|---|
| `src/lib/paypal.ts` | `paypalBase()`, `getAppAccessToken()` (client-credentials token, cached in memory until `expires_in - 60s`), `paypalFetch(path, init)` (adds the bearer token and JSON headers, and throws `PaypalError(status, name, message, debugId)` on non-2xx), `signState(payload)` / `verifyState(state)` (HMAC-SHA256 with `PAYPAL_STATE_SECRET`, base64url, 10-minute expiry). Plain `fetch`, no SDK: it's a handful of calls and easy to mock. |
| `src/services/paypal.service.ts` | `buildConnectUrl`, `handleOAuthCallback`, `getAccount`, `disconnect`, `createDebtOrder`, `capturePayment`, `completeFromCapture`, `markFailed`, `markRefunded`, `handleWebhook`. |
| `src/policies/paypal.policy.ts` | `canPayDebt(userId, debt, pendingTx)`: user is the borrower, `debt.status === 'pending'`, and there's no pending `DebtTransaction`. |
| `src/components/emails/paypal-payment-received.tsx` | Email to the lender: "{borrower} paid you $X with PayPal for {description}" + link to the debt. |
| `src/components/emails/paypal-payment-refunded.tsx` | Email to both people when a capture is refunded or reversed. |
| Routes | See P.6. |

### P.6 Flows and routes

#### Connect

```
client ──GET /api/paypal/connect?platform=ios|web──► { url }                       (auth: Bearer or cookie)
client opens url (web: window.location; iOS: WebBrowser.openAuthSessionAsync(url, 'brokebesties://paypal/connected'))
PayPal login + consent ──► GET /api/paypal/callback?code&state                      (public; state proves who)
   verifyState → exchange code → fetch userinfo → upsert PaypalAccount
   ──302──► web: /profile?paypal=connected        iOS: {scheme}://paypal/connected?status=ok
            (on error: ?paypal=error&reason=…     /  ?status=error&reason=…)
```

1. **`GET /api/paypal/connect?platform=ios|web`** (authenticated). Returns `{ url }`, where `url` = authorize page + `?flowEntry=static&client_id=…&response_type=code&scope=openid%20email%20https%3A%2F%2Furi.paypal.com%2Fservices%2Fpaypalattributes&redirect_uri={APP_URL}/api/paypal/callback&state={signState({ userId, platform, scheme, exp })}`. `scheme` is chosen server-side from an allow-list (`brokebesties`, `brokebesties-preview`, `brokebesties-dev`) based on the `X-App-Variant` header the app sends. It's never a free-form redirect.
2. **`GET /api/paypal/callback`** (public). `verifyState` (bad or expired → redirect with `reason=state`) → `POST /v1/oauth2/token` with `grant_type=authorization_code&code=…` (Basic auth with client id/secret) → `GET /v1/identity/oauth2/userinfo?schema=paypalv1.1` with the user's access token → read `payer_id` and the primary email with its `confirmed` flag → upsert `PaypalAccount` for `state.userId`. If that `payer_id` is already linked to a different user → redirect with `reason=in_use`. The user's PayPal access token is thrown away; we don't need ongoing access.
3. **`GET /api/paypal/account`** → `{ account: { email, emailVerified, connectedAt } | null }`.
4. **`DELETE /api/paypal/account`** → deletes the row → `{ message: 'PayPal disconnected' }`. Payments already created keep their `payeePayerId`.

#### Pay a debt

```
borrower ──POST /api/debts/:id/paypal/order──► { paymentId, approveUrl }
approveUrl (PayPal checkout, PAY_NOW) ──buyer approves──► GET {APP_URL}/paypal/return?pp=<paymentId>&token=<orderId>
   bridge page ──302──► web: /debts/:id?paypal=approved&pp=…     iOS: {scheme}://paypal/return?pp=…&status=approved
client ──POST /api/paypal/payments/:paymentId/capture──► { payment, debt }          (idempotent)
PayPal ──webhook PAYMENT.CAPTURE.COMPLETED──► POST /api/paypal/webhook ──► same completion path (safety net)
```

5. **`POST /api/debts/:id/paypal/order`** (authenticated borrower):
   - Load the debt with its lender, the lender's `PaypalAccount`, and pending transactions. 403 if `!canPayDebt`. 409 `The lender hasn't connected PayPal yet` if there's no account. 409 `A PayPal payment is already in progress for this debt` if a `PaypalPayment` in `CREATED|APPROVED` newer than 3 hours exists; in that case also return its `approveUrl` so the client can resume.
   - Create the `PaypalPayment` row first (`CREATED`, `amountCents = Math.round(debt.amount * 100)`), then `POST /v2/checkout/orders` with header `PayPal-Request-Id: {payment.id}` (idempotent retries):
     ```json
     {
       "intent": "CAPTURE",
       "purchase_units": [{
         "reference_id": "debt-42",
         "custom_id": "<paypalPayment.id>",
         "description": "Broke Besties: Dinner (debt #42)",
         "amount": { "currency_code": "USD", "value": "42.50" },
         "payee": { "merchant_id": "<lender payerId>" }
       }],
       "payment_source": { "paypal": { "experience_context": {
         "brand_name": "Broke Besties",
         "shipping_preference": "NO_SHIPPING",
         "user_action": "PAY_NOW",
         "return_url": "{APP_URL}/paypal/return?pp=<paymentId>&platform=ios",
         "cancel_url": "{APP_URL}/paypal/return?pp=<paymentId>&platform=ios&cancelled=1"
       } } }
     }
     ```
   - Save `orderId`; return `{ paymentId, approveUrl }`, where `approveUrl` is the `links[]` entry with `rel === 'payer-action'`.
   - The amount and payee **always come from the database**, never from the client.
6. **`GET /paypal/return`** (public Next.js route handler, `app/paypal/return/route.ts`). It does no money work: it only redirects. For `platform=ios` → `{scheme}://paypal/return?pp=…&status=approved|cancelled` (`returnScheme` stored on the payment when the order was created, itself chosen from the allow-list). For web → `/debts/{debtId}?paypal=approved|cancelled&pp=…`. When `cancelled=1`, mark the payment `CANCELLED` if it's still `CREATED`.
7. **`POST /api/paypal/payments/:id/capture`** (authenticated; must be the payer). If already `COMPLETED` → return it (idempotent). Otherwise `POST /v2/checkout/orders/{orderId}/capture` with `PayPal-Request-Id: capture-{id}`:
   - Capture status `COMPLETED` → `completeFromCapture()` (P.8) → `200 { payment, debt }`.
   - `PENDING` (e.g. an eCheck) → set `APPROVED` → `202 { payment }`. The webhook finishes it later, and the UI says "PayPal is processing this payment".
   - `ORDER_NOT_APPROVED` → 409 `Payment wasn't approved in PayPal`. `INSTRUMENT_DECLINED` → 402 `PayPal declined the payment method. Try again with a different one.` and keep the payment `CREATED` so the approve link can be reopened. Anything else → `FAILED` with `failureReason` → 502.
8. **`GET /api/debts/:id`** (extends B7) adds:
   ```jsonc
   "paypal": {
     "lenderConnected": true,
     "canPay": true,                       // viewer is the borrower and canPayDebt(...)
     "payments": [ { "id": "…", "status": "COMPLETED", "amountCents": 4250, "createdAt": "…", "completedAt": "…" } ]
   }
   ```

### P.7 Webhook

**`POST /api/paypal/webhook`** (public). Subscribe to these events in the PayPal dashboard (sandbox and live apps separately) at `{APP_URL}/api/paypal/webhook`: `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`.

1. **Always verify** the signature: `POST /v1/notifications/verify-webhook-signature` with the `paypal-transmission-id`, `-time`, `-sig`, `paypal-cert-url`, and `paypal-auth-algo` headers, `webhook_id: PAYPAL_WEBHOOK_ID`, and the raw event. Anything other than `verification_status === 'SUCCESS'` → 400. **No bypass when env vars are missing**: return 500 instead. That's the opposite of the current Stripe webhook's fallback, which should be fixed the same way.
2. Find the `PaypalPayment` by `custom_id` / `supplementary_data.related_ids.order_id`. Ignore events for unknown orders with a 200 (they're not ours).
3. Handle:
   - `CHECKOUT.ORDER.APPROVED` → capture (the client may never come back if the app was killed).
   - `PAYMENT.CAPTURE.COMPLETED` → `completeFromCapture()`.
   - `PAYMENT.CAPTURE.PENDING` → `APPROVED`.
   - `PAYMENT.CAPTURE.DENIED` → `FAILED`.
   - `PAYMENT.CAPTURE.REFUNDED` / `REVERSED` → `markRefunded()`.
4. Return 200 quickly. Everything is idempotent, because PayPal retries.

### P.8 Settlement rules (`completeFromCapture`, one Prisma transaction)

1. Re-read the payment `FOR UPDATE`-style (`updateMany where status != 'COMPLETED'`). If nothing was updated, it was already completed → return.
2. **Verify** that the capture amount equals `amountCents`, the currency is `USD`, and the capture payee `merchant_id` equals `payeePayerId`. On a mismatch → `FAILED` with a reason, log an error, and **don't** touch the debt.
3. Set the payment `COMPLETED`, `captureId`, `completedAt`.
4. If the debt still exists and is `pending`:
   - `debt.status = 'paid'`; turn off its alert (`isActive=false`), as `confirm_paid` does.
   - Cancel any pending `DebtTransaction` on the debt (`status='cancelled'`, `resolvedAt=now`).
   - Create a `DebtTransaction { type:'confirm_paid', status:'approved', requesterId: payer, lenderApproved:true, borrowerApproved:true, reason:'Paid with PayPal (capture <captureId>)', resolvedAt: now }`, so the Activity timeline on web and mobile shows it with no UI changes.
5. If the debt was deleted or already marked paid in the meantime, keep the payment `COMPLETED` and email both people: "A PayPal payment was received for a debt that was already settled." Refunds are handled in PayPal by the lender.
6. After the transaction commits: send `paypal-payment-received` to the lender.

`markRefunded`: set the payment `REFUNDED`. If the debt is `paid` **and** its latest approved transaction came from this capture, set the debt back to `pending` and add a `DebtTransaction { type:'confirm_paid', status:'cancelled', reason:'PayPal payment refunded' }`. Email both people.

### P.9 Fallback (if G1 fails): PayPal.me link

- Connect also asks for an optional **PayPal.me username** (`PaypalAccount.paypalMe String?`, validated against `^[A-Za-z0-9]{1,20}$`).
- The borrower's "Pay with PayPal" opens `https://paypal.me/{username}/{amount}USD` in the browser. When they come back, the app asks "Did you complete the payment?" → **Yes** creates the normal `confirm_paid` request (the lender still confirms, as today).
- Everything in P.4 except `PaypalPayment`, and everything in P.6 steps 1–4, stays the same.

### P.10 Web UI (keep the website at parity)

- **Profile** gets a "PayPal" card: not connected → "Connect PayPal" button (redirects to `url`); connected → "Connected as {email}" + a "Verified" badge + "Disconnect" (confirm). It reads `?paypal=connected|error` for a toast.
- **Debt detail** (borrower, `paypal.canPay`) gets a "Pay ${amount} with PayPal" button next to "Mark as paid". When the lender isn't connected: muted text "{lender} hasn't connected PayPal". It handles `?paypal=approved&pp=` by calling capture and then `router.refresh()`.
- **Activity card:** a `confirm_paid` transaction whose reason starts with "Paid with PayPal" gets a PayPal badge.

### P.11 Security checklist

- [ ] The amount, currency, and payee are computed on the server from the DB, never taken from the request body.
- [ ] The OAuth `state` is HMAC-signed, expires after 10 minutes, and carries the `userId` (the callback has no session).
- [ ] The return-redirect scheme comes from an allow-list; there are no open redirects.
- [ ] Webhook signature verification is required; there's no unsigned fallback.
- [ ] `PayPal-Request-Id` on create and capture; `completeFromCapture` is idempotent (safe for double capture plus the webhook).
- [ ] Capture amount/currency/payee are checked before a debt is changed.
- [ ] Client secret only on the server; mobile gets URLs, never tokens.
- [ ] The rate limit on `POST …/paypal/order` is 5 per minute per user (a simple in-memory or Upstash counter).

### P.12 Tests (`vitest`, mock `fetch`)

- `lib/paypal.test.ts`: token caching and refresh; `signState`/`verifyState` (tampered, expired); `PaypalError` parsing.
- `paypal.service.test.ts`:
  - connect callback happy path; `payer_id` already linked to another user
  - order creation: 403 non-borrower, paid debt, pending transaction; 409 lender not connected; request body uses the DB amount and `payee.merchant_id`; resume an existing in-progress payment
  - capture `COMPLETED` → debt paid + audit transaction + alert off + pending transactions cancelled + email
  - capture `PENDING` → 202
  - `INSTRUMENT_DECLINED` → 402 and stays `CREATED`
  - double completion (capture + webhook) → one audit transaction, one email
  - amount mismatch → `FAILED`, debt untouched
  - refund → debt back to pending
- `api/paypal/webhook` route: bad signature → 400; unknown order → 200 no-op; each event type dispatches.

### P.13 Sandbox setup (developer steps)

1. developer.paypal.com → Apps & Credentials → **Sandbox** → Create App "Broke Besties (sandbox)" (Merchant type). Copy the client id and secret.
2. In the app: turn on **Log in with PayPal**, set the return URL to `http://localhost:3000/api/paypal/callback` (plus the staging URL), and choose the email + payer ID attributes.
3. Webhooks → Add → `{staging URL}/api/paypal/webhook` with the P.7 events → copy the **Webhook ID**. Local dev: use a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and a second sandbox webhook.
4. Sandbox → Accounts: create two **Personal** sandbox accounts (lender and borrower). Connect the lender in the app; log in as the borrower in Checkout.
5. Check G1 and G2 in sandbox; then ask PayPal (merchant support / partner team) to confirm live eligibility for personal payees **before** starting the mobile UI.
6. Live: create the Live app, repeat steps 2–3, set `PAYPAL_ENV=live` in Vercel production.


---

## Part C: API contract (everything the app calls)

**Base URL:** `EXPO_PUBLIC_API_URL` (e.g. `https://brokebesties.app`). **Auth:** `Authorization: Bearer <supabase access_token>` on every `/api/*` call. **Content type:** JSON, except receipt upload (multipart).
**Errors:** always `{ "error": string }` with a 4xx/5xx status. The client turns these into `ApiError(status, message)` (mobile-app.md Part B, `src/lib/api/client.ts`).
**Dates:** ISO-8601 strings (Prisma `DateTime` serialized). **Money:** `number` dollars.
Routes marked **NEW** or **CHANGED** come from Part A.

### C.1 Endpoint table

#### Session and user

| # | Method | Path | Body / query | 2xx response | Notable errors | Used by |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/user` | – | `{ user: User }` | 401, 404 | Profile, bootstrap |
| 2 | PATCH | `/api/user` | `{ name: string }` | `{ user: User }` | 400 `Name is required` | Profile, Apple first sign-in |
| 3 | DELETE | `/api/user` **NEW** | – | `{ message }` | 401 | Profile → Delete account |
| 4 | GET | `/api/me/counts` **NEW** | – | `NavCounts` | 401 | Tab badges |
| 5 | GET | `/api/dashboard` **NEW** | – | `DashboardData` | 401 | Home |
| 6 | GET | `/api/users/search` | `?email=` (exact match) | `{ user: { id, email } }` | 404 `User not found` | Recurring borrower lookup |

Sign up, log in, OAuth, and log out go **directly to Supabase** through `supabase-js` (mobile-app.md §E.2). The app never calls `/api/auth/login|signup|callback`: those set browser cookies, which mean nothing to a native app.

#### Debts

| # | Method | Path | Body / query | 2xx response | Notable errors |
|---|---|---|---|---|---|
| 7 | GET | `/api/debts` | `?type=lending\|borrowing&status=pending\|paid` (both optional) | `{ debts: Debt[] }` | – |
| 8 | POST | `/api/debts` | `{ amount, description?, borrowerId, groupId?, receiptIds?: string[] }` | `201 { message, debt: Debt }` | 400 `Valid amount is required` / `Borrower ID is required` / `Cannot create a debt to yourself`; 404 `Borrower not found` / `One or more receipts not found` |
| 9 | GET | `/api/debts/:id` **CHANGED** | – | `{ debt: DebtDetail, transactions: DebtTransaction[], receiptImageUrls: {id,url}[], paypal: DebtPaypalInfo }` | 403, 404 |
| 10 | PATCH | `/api/debts/:id` | `{ status: 'pending'\|'paid' }` (group screen only; see Part A note 1) | `{ message, debt }` | 403, 404 |

#### Debt change requests (debt transactions)

| # | Method | Path | Body | 2xx response | Notable errors |
|---|---|---|---|---|---|
| 11 | GET | `/api/debt-transactions` | – | `{ transactions: PendingTransaction[] }` (every pending one where you're lender or borrower) | – |
| 12 | POST | `/api/debt-transactions` | `{ debtId, type: 'confirm_paid'\|'modify'\|'drop', proposedAmount?, proposedDescription?, reason? }` | `201 { transaction }` | 400 `There is already a pending transaction for this debt` / `Modification must include at least one change (amount or description)` / `Proposed amount must be positive`; 403 |
| 13 | PATCH | `/api/debt-transactions/:id` | `{ approve: boolean }` | `{ transaction, debtUpdated: boolean }` | 400 `This transaction has already been processed`; 403; 404 |
| 14 | DELETE | `/api/debt-transactions/:id` | – | `{ message }` | 403 `Only the requester can cancel this transaction`; 400 already processed |

The requester's side is approved automatically when a request is created. The change is applied when both `lenderApproved` and `borrowerApproved` are true. `confirm_paid` → debt `status='paid'` + alert turned off. `modify` → the proposed fields are applied. `drop` → the debt is deleted.

#### Reminders (alerts)

| # | Method | Path | Body / query | 2xx response | Notable errors |
|---|---|---|---|---|---|
| 15 | GET | `/api/alerts` **CHANGED** | `?role=lender` (default: borrower) | `{ alerts: Alert[] }` (active only) | – |
| 16 | POST | `/api/alerts` | `{ debtId, message?, deadline?: ISO date, reminderFrequencyDays?: 7\|14\|30\|null }` **or** `{ recurringPaymentId, message?, reminderFrequencyDays? }` | `201 { message, alert }` | 400 `Only the lender can create alerts for this debt` / `This debt already has an alert` |
| 17 | PUT | `/api/alerts/:id` | `{ message?, deadline?: ISO\|null, isActive?, reminderFrequencyDays?: number\|null }` | `{ message, alert }` | 400 frequency not a positive integer; 403 |
| 18 | DELETE | `/api/alerts/:id` | – | `{ message }` | 403 (lender only) |
| 19 | POST | `/api/alerts/:id/opt-out` | – | `{ message, alert }` | 403 `Only the borrower…`; 404 |

#### Receipts

| # | Method | Path | Body | 2xx response | Notable errors |
|---|---|---|---|---|---|
| 20 | POST | `/api/receipts/upload` | **multipart**: `file` (jpeg/png/webp, ≤ 10 MB; mobile sends JPEG ≤ ~2 MB), `debtIds?` (`"[1,2]"` or `"1,2"`) | `{ success: true, data: { id: string, signedUrl: string } }` | 400 type/size; 500 storage |
| 21 | POST | `/api/receipts/:id/parse` | – | `{ success: true, data: { id, rawText, items: { name, price }[] } }` | 403, 404, 500 (Gemini) |
| 22 | GET | `/api/receipts/:id/items` | – | `{ items: ReceiptItem[] }` | 403, 404 |
| 23 | PATCH | `/api/receipts/:id` | `{ debtIds: number[] }` | `{ success: true }` | 403/404 (after B3) |
| 24 | DELETE | `/api/receipts/:id` | – | `{ success: true }` | 403/404 (after B3) |

Vercel limits serverless request bodies to **4.5 MB**. The app resizes and compresses every image before upload (mobile-app.md §E.4) and must never send more than 4 MB.

#### Groups and invites

| # | Method | Path | Body | 2xx response | Notable errors |
|---|---|---|---|---|---|
| 25 | GET | `/api/groups` | – | `{ groups: GroupSummary[] }` | – |
| 26 | POST | `/api/groups` | `{ name }` | `{ message, group }` (status 200, not 201) | 400 `Group name is required` |
| 27 | GET | `/api/groups/:id` | – | `{ group: GroupDetail }` (members + pending invites) | 400, 404 (after B6) |
| 28 | GET | `/api/groups/:id/debts` **NEW** | – | `{ debts: Debt[] }` | 403 |
| 29 | POST | `/api/groups/:id/members` **NEW** | `{ friendUserId }` | `201 { member }` | 400 not friends / already a member; 403 |
| 30 | POST | `/api/invites` | `{ groupId, invitedEmail }` | `{ message, invite }` | 400 `Invite already exists for this email` / `User is already a member of this group`; 403 |
| 31 | GET | `/api/invites` | – | `{ invites: InviteForMe[] }` (pending, for your email) | – |
| 32 | POST | `/api/invites/accept` | `{ inviteId }` | `{ message, group }` | 400 already processed; 403; 404 |
| 33 | POST | `/api/invites/:id/reject` **NEW** | – | `{ message }` | 403, 404 |
| 34 | DELETE | `/api/invites/:id` **NEW** | – | `{ message }` | 403 (sender only), 404 |

#### Friends

| # | Method | Path | Body / query | 2xx response | Notable errors |
|---|---|---|---|---|---|
| 35 | GET | `/api/friends` | – | `{ friends: Friendship[] }` (accepted) | – |
| 36 | POST | `/api/friends` **CHANGED** | `{ email }` or `{ recipientId }` | `201 { message, friend, autoAccepted: boolean }` | 400 `You cannot send a friend request to yourself` / `You are already friends with this user` / `Friend request already exists`; 404 `User not found` |
| 37 | GET | `/api/friends/requests` | – | `{ requests: FriendRequest[] }` (incoming pending) | – |
| 38 | GET | `/api/friends/requests/sent` | – | `{ requests: FriendRequest[] }` | – |
| 39 | POST | `/api/friends/:id/accept` | – | `{ message, friend }` | 403, 404 |
| 40 | DELETE | `/api/friends/:id` | – | `{ message }` (removes / cancels / rejects, depending on state) | 403, 404 |
| 41 | GET | `/api/friends/search` **NEW** | `?q=` | `{ friends: Friendship[] }` | – |
| 42 | GET | `/api/friends/recent` **NEW** | `?limit=5` | `{ friends: Friendship[] }` | – |

#### Tabs

| # | Method | Path | Body / query | 2xx response | Notable errors |
|---|---|---|---|---|---|
| 43 | GET | `/api/tabs` **NEW** | `?status=` optional | `{ tabs: Tab[] }` | – |
| 44 | POST | `/api/tabs` **NEW** | `{ amount, description, personName, status: 'lending'\|'borrowing' }` | `201 { tab }` | 400 validation |
| 45 | PATCH | `/api/tabs/:id` **NEW** | `{ status?: 'lending'\|'borrowing'\|'paid', amount?, description?, personName? }` | `{ tab }` | 400, 403, 404 |
| 46 | DELETE | `/api/tabs/:id` **NEW** | – | `{ message }` | 403, 404 |

#### Recurring payments

| # | Method | Path | Body / query | 2xx response | Notable errors |
|---|---|---|---|---|---|
| 47 | GET | `/api/recurring-payments` | `?type=lending\|borrowing&status=active\|inactive` | `{ recurringPayments: RecurringPayment[] }` | – |
| 48 | POST | `/api/recurring-payments` **CHANGED** | `{ amount, description?, frequency: number(days ≥ 1), borrowers: ({ email } \| { userId }) & { splitPercentage }[] }` | `201 { message, recurringPayment }` | 400 split sum / duplicates / frequency; 404 user not found |
| 49 | GET | `/api/recurring-payments/:id` | – | `{ recurringPayment: RecurringPaymentDetail }` (includes `alert`) | 403, 404 |
| 50 | PATCH | `/api/recurring-payments/:id` | `{ status: 'active'\|'inactive' }` (also `amount`, `description`, `frequency`) | `{ message, recurringPayment }` | 400, 403, 404 |
| 51 | DELETE | `/api/recurring-payments/:id` | – | `{ message }` | 403 (lender only), 404 |


### PayPal (Part B)

| # | Method | Path | Body / query | 2xx response | Notable errors |
|---|---|---|---|---|---|
| 52 | GET | `/api/paypal/account` **NEW** | – | `{ account: PaypalAccountInfo \| null }` | 401 |
| 53 | GET | `/api/paypal/connect` **NEW** | `?platform=ios` + header `X-App-Variant` | `{ url }` (open it in the auth browser) | 401 |
| 54 | DELETE | `/api/paypal/account` **NEW** | – | `{ message }` | 401 |
| 55 | POST | `/api/debts/:id/paypal/order` **NEW** | `{ platform: 'ios' }` | `{ paymentId, approveUrl }` | 403 not the borrower / debt not payable; 409 lender not connected / payment in progress (body includes `approveUrl` to resume); 502 PayPal error |
| 56 | POST | `/api/paypal/payments/:id/capture` **NEW** | – | `200 { payment: PaypalPaymentInfo, debt }` or `202 { payment }` (pending at PayPal) | 402 declined; 403 not the payer; 409 not approved; 502 |

Not called by the app (browser/PayPal only): `GET /api/paypal/callback`, `GET /paypal/return`, `POST /api/paypal/webhook`.

The app finishes the connect and pay browser sessions on these scheme URLs: `{scheme}://paypal/connected?status=ok|error&reason=` and `{scheme}://paypal/return?pp=<paymentId>&status=approved|cancelled`.

"Pause/Resume" on mobile = `PATCH { status: current === 'active' ? 'inactive' : 'active' }`. The web's toggle action does the same thing server-side.

### C.2 Types: `apps/mobile/src/lib/api/types.ts` (write exactly this)

```ts
// Hand-written from apps/web services (Prisma includes). Dates arrive as ISO strings.
export type ISODate = string;
export type ID = string;          // Supabase auth uid / cuid

export type UserLite = { id: ID; email: string; name: string | null };
export type User = UserLite & { createdAt: ISODate; updatedAt: ISODate; premium: boolean };

export type NavCounts = { debtRequests: number; invites: number; friendRequests: number };

export type DebtStatus = 'pending' | 'paid';
export type GroupRef = { id: number; name: string };
export type ReceiptRecord = { id: ID; rawText: string | null; uploaderId: ID | null; createdAt: ISODate; updatedAt: ISODate };

export type Debt = {
  id: number; amount: number; description: string | null; status: DebtStatus;
  lenderId: ID; borrowerId: ID; groupId: number | null; alertId: number | null;
  createdAt: ISODate; updatedAt: ISODate;
  lender: UserLite; borrower: UserLite; group: GroupRef | null; receipts: ReceiptRecord[];
};

export type Alert = {
  id: number; message: string | null; deadline: ISODate | null; groupId: number | null;
  lenderId: ID; borrowerId: ID; isActive: boolean; reminderFrequencyDays: number | null;
  lastReminderSentAt: ISODate | null; createdAt: ISODate; updatedAt: ISODate;
};
export type AlertWithRelations = Alert & {
  lender: UserLite; borrower: UserLite; group: GroupRef | null;
  debt: { id: number; amount: number; description: string | null; status: DebtStatus } | null;
  recurringPayment: { id: number; amount: number; description: string | null; status: RecurringStatus } | null;
};

export type DebtDetail = Debt & { alert: Alert | null };

export type TransactionType = 'confirm_paid' | 'modify' | 'drop';
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type DebtTransaction = {
  id: number; debtId: number; type: TransactionType; status: TransactionStatus;
  requesterId: ID; lenderApproved: boolean; borrowerApproved: boolean;
  proposedAmount: number | null; proposedDescription: string | null; reason: string | null;
  createdAt: ISODate; updatedAt: ISODate; resolvedAt: ISODate | null;
  requester: UserLite;
};
export type PendingTransaction = DebtTransaction & {
  debt: Omit<Debt, 'receipts'> & { lender: UserLite; borrower: UserLite; group: GroupRef | null };
};
export type PaypalPaymentStatus = 'CREATED' | 'APPROVED' | 'COMPLETED' | 'CANCELLED' | 'FAILED' | 'REFUNDED';
export type PaypalPaymentInfo = { id: ID; status: PaypalPaymentStatus; amountCents: number; createdAt: ISODate; completedAt: ISODate | null };
export type PaypalAccountInfo = { email: string; emailVerified: boolean; connectedAt: ISODate };
export type DebtPaypalInfo = { lenderConnected: boolean; canPay: boolean; payments: PaypalPaymentInfo[] };

export type DebtDetailResponse = {
  debt: DebtDetail; transactions: DebtTransaction[]; receiptImageUrls: { id: ID; url: string }[];
  paypal: DebtPaypalInfo;
};

export type GroupMember = { id: number; userId: ID; groupId: number; createdAt: ISODate; user: User };
export type GroupSummary = { id: number; name: string; createdAt: ISODate; updatedAt: ISODate;
  members: GroupMember[]; _count: { members: number } };
export type GroupInvite = { id: number; groupId: number; invitedBy: ID; invitedEmail: string;
  status: 'pending' | 'accepted' | 'rejected'; createdAt: ISODate; updatedAt: ISODate;
  sender: { id: ID; email: string } };
export type GroupDetail = { id: number; name: string; createdAt: ISODate; updatedAt: ISODate;
  members: GroupMember[]; invites: GroupInvite[] };
export type InviteForMe = Omit<GroupInvite, 'sender'> & {
  group: { id: number; name: string; members: GroupMember[] }; sender: User };

export type Friendship = { id: number; requesterId: ID; recipientId: ID; status: 'accepted';
  createdAt: ISODate; updatedAt: ISODate; requester: User; recipient: User; friend: User };
export type FriendRequest = Omit<Friendship, 'friend' | 'status'> & { status: 'pending' };

export type TabStatus = 'lending' | 'borrowing' | 'paid';
export type Tab = { id: number; amount: number; description: string; personName: string;
  status: TabStatus; userId: ID; createdAt: ISODate; updatedAt: ISODate };

export type RecurringStatus = 'active' | 'inactive';
export type RecurringBorrower = { id: number; userId: ID; recurringPaymentId: number;
  splitPercentage: number; createdAt: ISODate; user: User };
export type RecurringPayment = { id: number; amount: number; description: string | null;
  status: RecurringStatus; lenderId: ID; groupId: number | null; alertId: number | null;
  frequency: number; createdAt: ISODate; updatedAt: ISODate; lender: User; borrowers: RecurringBorrower[] };
export type RecurringPaymentDetail = RecurringPayment & { alert: Alert | null };

export type ReceiptItem = { id: ID; receiptId: ID; name: string; price: number; createdAt: ISODate; updatedAt: ISODate };
export type ParsedReceipt = { id: ID; rawText: string; items: { name: string; price: number }[] };

export type DashboardData = {
  user: UserLite; debts: Debt[]; groups: GroupSummary[]; tabs: Tab[];
  recurringPayments: RecurringPayment[]; alerts: AlertWithRelations[];
  pendingApprovals: PendingTransaction[]; counts: NavCounts;
};
```

### C.3 Endpoint functions: `apps/mobile/src/lib/api/endpoints.ts`

One typed function per row of the table above, grouped in namespaces. Screens and hooks never call `fetch` or `api.get` directly.

```ts
export const userApi = {
  me: () => api.get<{ user: User }>('/api/user').then(r => r.user),
  updateName: (name: string) => api.patch<{ user: User }>('/api/user', { name }).then(r => r.user),
  deleteAccount: () => api.del<{ message: string }>('/api/user'),
  counts: () => api.get<NavCounts>('/api/me/counts'),
  dashboard: () => api.get<DashboardData>('/api/dashboard'),
  findByEmail: (email: string) =>
    api.get<{ user: { id: ID; email: string } }>(`/api/users/search?email=${encodeURIComponent(email)}`).then(r => r.user),
};

export const debtsApi = {
  list: (f: { type?: 'lending' | 'borrowing'; status?: DebtStatus } = {}) =>
    api.get<{ debts: Debt[] }>(`/api/debts${qs(f)}`).then(r => r.debts),
  create: (b: { amount: number; description?: string; borrowerId: ID; groupId?: number; receiptIds?: ID[] }) =>
    api.post<{ debt: Debt }>('/api/debts', b).then(r => r.debt),
  detail: (id: number) => api.get<DebtDetailResponse>(`/api/debts/${id}`),
  setStatus: (id: number, status: DebtStatus) => api.patch<{ debt: Debt }>(`/api/debts/${id}`, { status }),
};

export const requestsApi = {
  pending: () => api.get<{ transactions: PendingTransaction[] }>('/api/debt-transactions').then(r => r.transactions),
  create: (b: { debtId: number; type: TransactionType; proposedAmount?: number; proposedDescription?: string; reason?: string }) =>
    api.post<{ transaction: PendingTransaction }>('/api/debt-transactions', b).then(r => r.transaction),
  respond: (id: number, approve: boolean) =>
    api.patch<{ transaction: PendingTransaction; debtUpdated: boolean }>(`/api/debt-transactions/${id}`, { approve }),
  cancel: (id: number) => api.del(`/api/debt-transactions/${id}`),
};

export const alertsApi = {
  forMe: () => api.get<{ alerts: AlertWithRelations[] }>('/api/alerts').then(r => r.alerts),
  created: () => api.get<{ alerts: AlertWithRelations[] }>('/api/alerts?role=lender').then(r => r.alerts),
  createForDebt: (b: { debtId: number; message?: string | null; deadline?: string | null; reminderFrequencyDays: number | null }) =>
    api.post<{ alert: Alert }>('/api/alerts', b).then(r => r.alert),
  createForRecurring: (b: { recurringPaymentId: number; message?: string | null; reminderFrequencyDays: number | null }) =>
    api.post<{ alert: Alert }>('/api/alerts', b).then(r => r.alert),
  update: (id: number, b: Partial<Pick<Alert, 'message' | 'deadline' | 'isActive' | 'reminderFrequencyDays'>>) =>
    api.put<{ alert: Alert }>(`/api/alerts/${id}`, b).then(r => r.alert),
  remove: (id: number) => api.del(`/api/alerts/${id}`),
  optOut: (id: number) => api.post(`/api/alerts/${id}/opt-out`),
};

export const receiptsApi = {
  upload: (file: { uri: string; name: string; type: 'image/jpeg' }, debtIds?: number[]) =>
    api.upload<{ data: { id: ID; signedUrl: string } }>('/api/receipts/upload', file, debtIds ? { debtIds: JSON.stringify(debtIds) } : undefined).then(r => r.data),
  parse: (id: ID) => api.post<{ data: ParsedReceipt }>(`/api/receipts/${id}/parse`).then(r => r.data),
  items: (id: ID) => api.get<{ items: ReceiptItem[] }>(`/api/receipts/${id}/items`).then(r => r.items),
  link: (id: ID, debtIds: number[]) => api.patch(`/api/receipts/${id}`, { debtIds }),
  remove: (id: ID) => api.del(`/api/receipts/${id}`),
};

export const groupsApi = {
  list: () => api.get<{ groups: GroupSummary[] }>('/api/groups').then(r => r.groups),
  create: (name: string) => api.post<{ group: GroupSummary }>('/api/groups', { name }).then(r => r.group),
  detail: (id: number) => api.get<{ group: GroupDetail }>(`/api/groups/${id}`).then(r => r.group),
  debts: (id: number) => api.get<{ debts: Debt[] }>(`/api/groups/${id}/debts`).then(r => r.debts),
  addFriend: (id: number, friendUserId: ID) => api.post(`/api/groups/${id}/members`, { friendUserId }),
};

export const invitesApi = {
  mine: () => api.get<{ invites: InviteForMe[] }>('/api/invites').then(r => r.invites),
  send: (groupId: number, invitedEmail: string) =>
    api.post('/api/invites', { groupId, invitedEmail: invitedEmail.trim().toLowerCase() }),
  accept: (inviteId: number) => api.post<{ group: GroupSummary }>('/api/invites/accept', { inviteId }),
  reject: (inviteId: number) => api.post(`/api/invites/${inviteId}/reject`),
  cancel: (inviteId: number) => api.del(`/api/invites/${inviteId}`),
};

export const friendsApi = {
  list: () => api.get<{ friends: Friendship[] }>('/api/friends').then(r => r.friends),
  incoming: () => api.get<{ requests: FriendRequest[] }>('/api/friends/requests').then(r => r.requests),
  sent: () => api.get<{ requests: FriendRequest[] }>('/api/friends/requests/sent').then(r => r.requests),
  addByEmail: (email: string) =>
    api.post<{ autoAccepted: boolean; message: string }>('/api/friends', { email: email.trim().toLowerCase() }),
  accept: (id: number) => api.post(`/api/friends/${id}/accept`),
  remove: (id: number) => api.del(`/api/friends/${id}`), // also cancel + reject
  search: (q: string) => api.get<{ friends: Friendship[] }>(`/api/friends/search?q=${encodeURIComponent(q)}`).then(r => r.friends),
  recent: (limit = 5) => api.get<{ friends: Friendship[] }>(`/api/friends/recent?limit=${limit}`).then(r => r.friends),
};

export const tabsApi = {
  list: () => api.get<{ tabs: Tab[] }>('/api/tabs').then(r => r.tabs),
  create: (b: { amount: number; description: string; personName: string; status: 'lending' | 'borrowing' }) =>
    api.post<{ tab: Tab }>('/api/tabs', b).then(r => r.tab),
  update: (id: number, b: Partial<Pick<Tab, 'amount' | 'description' | 'personName' | 'status'>>) =>
    api.patch<{ tab: Tab }>(`/api/tabs/${id}`, b).then(r => r.tab),
  remove: (id: number) => api.del(`/api/tabs/${id}`),
};

export const recurringApi = {
  list: (f: { type?: 'lending' | 'borrowing'; status?: RecurringStatus } = {}) =>
    api.get<{ recurringPayments: RecurringPayment[] }>(`/api/recurring-payments${qs(f)}`).then(r => r.recurringPayments),
  detail: (id: number) =>
    api.get<{ recurringPayment: RecurringPaymentDetail }>(`/api/recurring-payments/${id}`).then(r => r.recurringPayment),
  create: (b: { amount: number; description?: string; frequency: number; borrowers: { email: string; splitPercentage: number }[] }) =>
    api.post<{ recurringPayment: RecurringPayment }>('/api/recurring-payments', b).then(r => r.recurringPayment),
  setStatus: (id: number, status: RecurringStatus) => api.patch(`/api/recurring-payments/${id}`, { status }),
  remove: (id: number) => api.del(`/api/recurring-payments/${id}`),
};

export const paypalApi = {
  account: () => api.get<{ account: PaypalAccountInfo | null }>('/api/paypal/account').then(r => r.account),
  connectUrl: () => api.get<{ url: string }>('/api/paypal/connect?platform=ios').then(r => r.url),
  disconnect: () => api.del('/api/paypal/account'),
  createOrder: (debtId: number) =>
    api.post<{ paymentId: ID; approveUrl: string }>(`/api/debts/${debtId}/paypal/order`, { platform: 'ios' }),
  capture: (paymentId: ID) =>
    api.post<{ payment: PaypalPaymentInfo; debt?: Debt }>(`/api/paypal/payments/${paymentId}/capture`, {}, { timeoutMs: 45_000 }),
};
```

`qs()` builds `?a=b&c=d` from the defined values only.
