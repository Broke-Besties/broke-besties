# Broke Besties backend spec (`apps/web`)

Everything the website's backend needs for the iOS app: prerequisites (Part A) and the full API contract the app codes against (Part B). All new routes follow the existing pattern: `getUser()` → 401 if null → call a service → map known error messages to status codes → `NextResponse.json`.

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

## Part B: API contract (everything the app calls)

**Base URL:** `EXPO_PUBLIC_API_URL` (e.g. `https://brokebesties.app`). **Auth:** `Authorization: Bearer <supabase access_token>` on every `/api/*` call. **Content type:** JSON, except receipt upload (multipart).
**Errors:** always `{ "error": string }` with a 4xx/5xx status. The client turns these into `ApiError(status, message)` (mobile-app.md Part B, `src/lib/api/client.ts`).
**Dates:** ISO-8601 strings (Prisma `DateTime` serialized). **Money:** `number` dollars.
Routes marked **NEW** or **CHANGED** come from Part A.

### B.1 Endpoint table

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
| 9 | GET | `/api/debts/:id` **CHANGED** | – | `{ debt: DebtDetail, transactions: DebtTransaction[], receiptImageUrls: {id,url}[] }` | 403, 404 |
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


"Pause/Resume" on mobile = `PATCH { status: current === 'active' ? 'inactive' : 'active' }`. The web's toggle action does the same thing server-side.

### B.2 Types: `apps/mobile/src/lib/api/types.ts` (write exactly this)

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

export type DebtDetailResponse = {
  debt: DebtDetail; transactions: DebtTransaction[]; receiptImageUrls: { id: ID; url: string }[];
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

### B.3 Endpoint functions: `apps/mobile/src/lib/api/endpoints.ts`

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

```

`qs()` builds `?a=b&c=d` from the defined values only.
