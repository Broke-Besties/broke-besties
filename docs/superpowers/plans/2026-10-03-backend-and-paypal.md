# Backend prerequisites + PayPal — implementation plan

> Source spec: `specs/backend.md` (Part A: B1–B15, Part B: P.1–P.13, Part C: API contract).
> Mobile-side expectations: `specs/mobile-app.md` §E.6. This plan is the shared contract for
> the parallel work; when it and the spec disagree, this plan wins (deviations are listed).

**Goal:** every backend change the iOS app needs, plus PayPal connect + pay (backend and web UI),
with tests, in `apps/web`.

**Architecture:** Next.js 16 route handlers → services (`src/services`) → policies → Prisma 7
(Postgres) ; Supabase Auth (cookie for web, Bearer JWT for mobile). PayPal is plain `fetch`
against the REST API (no SDK).

**Tech:** TypeScript (strict), vitest 5 (node env, `src/**/*.test.ts`), Prisma 7, Resend +
react-email.

---

## 0. Ground rules (every work package)

1. **Test first.** Write the failing test, run it and watch it fail for the right reason,
   implement, watch it pass. Mock with `src/test/mocks.ts` (`createMockPrisma`,
   `createMockEmailService`, fixtures). **Do not edit `src/test/mocks.ts`** — it already has
   `updateMany/upsert/deleteMany/count`, the `paypalAccount/paypalPayment/receiptItem` models and
   the PayPal email methods. For interactive transactions use the existing pattern:
   `db.$transaction.mockImplementationOnce(async (fn) => fn(tx))` with a hand-built `tx`.
2. **Route pattern:** `getUser()` → 401 `{ error: "Unauthorized" }` → parse/validate params
   (400 `Invalid <thing> ID` for non-integer ids) → service → map known error messages to
   statuses → `NextResponse.json`. Errors are always `{ error: string }`. New routes must also
   turn malformed JSON / wrong JSON types into 400 (never a 500 from a `TypeError`).
3. **Route tests** go in new files directly under `src/app/api/` named `<area>-routes.test.ts`
   (pattern: `src/app/api/api-routes.test.ts` — `vi.mock("@/lib/supabase", () => ({ getUser: vi.fn() }))`,
   mock the service module, build `NextRequest`s). Never edit `api-routes.test.ts`.
4. **Style:** match the file you edit (quotes/semicolons vary per file). New files: double
   quotes + semicolons. Comments only where they explain *why*.
5. **`ponytail:` comments** (repo convention, see `groups-client.tsx`): mark every deliberate
   shortcut with `// ponytail: <what and why it's fine now> <how to upgrade>`.
6. **No new npm dependencies.**
7. **Verify before claiming done** (from `apps/web`):
   `pnpm test` (all green), `npx tsc --noEmit` (only the 6 pre-existing errors in
   `src/policies/policies.test.ts` may remain until package A fixes them), and
   `npx eslint <every file you created or changed>` — no new problems (the repo has 37
   pre-existing ones; don't fix unrelated ones).
8. **Commits:** small, imperative subject, body explains why. End every message with:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   Claude-Session: https://claude.ai/code/session_016FgCwYVdnkfRargPqfKCCu
   ```
9. **Own only your files** (ownership table below). If you truly need a change in someone
   else's file, don't make it — note it in your final report.
10. A local Postgres 16 is running at `127.0.0.1:5432` (user/password `postgres`). For any DB
    experiment create your **own** database (`createdb` via `psql -h 127.0.0.1 -U postgres`,
    `PGPASSWORD=postgres`), apply the Supabase stand-ins from
    `docs/superpowers/plans/assets/supabase-standins.sql`, then
    `DATABASE_URL=… DIRECT_URL=… npx prisma migrate deploy`. Never touch `bb_e2e`.

## 1. Deliberate deviations from the spec

| Spec | Plan | Why |
|---|---|---|
| P.4 `orderId String @unique` | `orderId String? @unique` | P.6 says create the row first, then the order, then "save orderId" — the row exists before the order id does. |
| P.6 #5 `approveUrl` for the in-progress 409 | rebuilt from `orderId` via `checkoutUrl(orderId)` (`{web}/checkoutnow?token=`) | No column stores PayPal's link; this is the URL PayPal returns as `payer-action`. |
| B1 module-level `tokenVerifier` | created lazily on first Bearer request | A module-level `createClient` throws when env vars are absent (tests, `next build`). |
| B13 "delete their pending Friend rows" | delete **all** their Friend rows | An accepted friendship with a deleted account lets others re-add "Deleted user" to groups (`createInviteAsFriend`) and create debts against it. |
| B13 (not listed) | also delete their `PaypalAccount`, received GroupInvites, deactivate recurring payments they lend | Same reasoning: no live ties to a deleted account. |
| P.10 / P.6 | `canPay` = borrower ∧ `canPayDebt` ∧ lender connected | mobile-app.md §D: "if `paypal.canPay` (I'm the borrower and the lender connected PayPal)". |
| P.7 step 2 | also match refunds by capture id (`supplementary_data.related_ids.capture_id`, `links[rel=up]`, `resource.id`) | Refund/reversal resources are refund objects; they don't always carry `custom_id`/`order_id`. |
| P.9 PayPal.me fallback | not built | Only needed if gate G1 fails; flagged for the owner. |

## 2. File ownership

| Package | Owns (create/modify) |
|---|---|
| **A — auth, receipts, account** | `src/lib/supabase.ts` (+ new `supabase.test.ts`); `prisma/migrations/20260928000000_handle_new_user_allow_missing_name/`; `src/services/receipt.service.ts` (+ new `receipt.service.test.ts`); `src/app/api/receipts/**`; `src/services/user.service.ts` (+ `user.service.test.ts`); `src/app/api/user/route.ts`; `supabase/config.toml`; `src/app/api/stripe/webhook/route.ts`; `src/policies/policies.test.ts` (type fixes only); new tests `src/app/api/{user,receipts,stripe-webhook}-routes.test.ts` |
| **B — REST parity** | `src/app/api/tabs/**`, `src/app/api/invites/[id]/**`, `src/app/api/groups/[id]/**`, `src/app/api/friends/route.ts`, `src/app/api/friends/{search,recent}/**`, `src/app/api/alerts/route.ts`, `src/app/api/me/**`, `src/app/api/dashboard/**`, `src/app/api/recurring-payments/route.ts`, `src/app/api/debt-transactions/route.ts`; `src/lib/dashboard-data.ts` (+test); `src/app/(app)/dashboard/page.tsx`; `src/services/recurring-payment.service.ts` (+test); new tests `src/app/api/{tabs,invites,groups,friends,alerts,me,dashboard,recurring,debt-transactions}-routes.test.ts` |
| **C — PayPal core** | `src/lib/paypal.ts` (+test); `src/services/paypal.service.ts` (+test) — replace stub bodies, keep the exported contract; `src/policies/paypal.policy.ts` (+ `paypal.policy.test.ts`), export from `src/policies/index.ts`; `src/components/emails/paypal-payment-{received,refunded}.tsx`; `src/services/email.service.ts` |
| **D — PayPal HTTP + debt detail API** | `src/app/api/paypal/**`, `src/app/api/debts/[id]/paypal/**`, `src/app/paypal/return/route.ts`, `src/app/api/debts/[id]/route.ts`, `src/lib/rate-limit.ts` (+test), `src/lib/paypal-http.ts`, `sample.env`; new tests `src/app/api/{paypal,paypal-webhook,debt-detail}-routes.test.ts` |
| **E — PayPal web UI** | `src/app/(app)/profile/**`, `src/app/(app)/debts/[id]/**`, new pure helpers + tests under those folders (`*.ts`) |

Shared, already final (Phase 0): `prisma/schema.prisma`, `prisma/migrations/20260929000000_add_paypal/`,
`src/test/mocks.ts`, `src/lib/paypal-errors.ts`.

## 3. Cross-package contract (Phase 0 stubs — code against these)

- **`src/lib/paypal-errors.ts`** (final): `PaypalError(status, paypalName, message, debugId, details)`
  with `.issue` (first `details[].issue`); `PaypalConfigError`; `PaypalFlowError(status, message, body)`.
- **`src/services/paypal.service.ts`** (stub; C implements): exported types `PaypalPlatform`,
  `PaypalPaymentStatus`, `PaypalAccountInfo`, `PaypalPaymentInfo`, `DebtPaypalInfo`,
  `PayableDebt`, `DebtWithParties` (+ `debtWithPartiesInclude`), `CaptureResult`,
  `PaypalCapture`, `CompletionOutcome`, `PaypalWebhookEvent`; singleton `paypalService` with
  `buildConnectUrl`, `handleOAuthCallback`, `getAccount`, `disconnect`, `getDebtPaypalInfo`,
  `createDebtOrder`, `capturePayment`, `completeFromCapture`, `markFailed`, `markRefunded`,
  `getReturnRedirect`, `verifyWebhookSignature`, `handleWebhook`. The JSDoc on each method
  (statuses, exact messages, redirect formats) is binding.
- **`receiptService.getSignedImageUrls(receiptIds: string[]): Promise<{ id: string; url: string }[]>`**
  (stub; A implements): 1-hour signed URLs for `receipts/{id}`, input order, failures skipped
  and logged, `[]` for `[]`, never throws.
- **Email methods** (C implements; mocks already list them):
  - `sendPaypalPaymentReceived({ to, recipientName, borrowerName, lenderName, amount, description, debtLink, alreadySettled? })`
  - `sendPaypalPaymentRefunded({ to, recipientName, borrowerName, lenderName, amount, description, debtLink, debtReopened })`
  (`amount` in dollars, `description: string | null`.) Both return `{ success, error? }` like the others.

## 4. Packages

### A — auth, receipts security, account deletion, config

- **B1** `getUser()` Bearer path per spec B1, but the stateless verifier
  (`createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })`
  from `@supabase/supabase-js`) is created lazily and memoized. A bad/expired token returns
  `null` (no cookie fallback). `bearer` is case-insensitive; an empty token falls through to
  cookies. `headers()` throwing (outside a request) falls through to cookies. Tests: the 4 in
  the spec + empty-token and headers-throw cases.
- **B2** migration exactly as the spec, plus `SET search_path = ''` on the SECURITY DEFINER
  function (hardening; every reference is schema-qualified or pg_catalog). Prove it on your own
  DB: insert into `auth.users` rows with Apple-like metadata (no name), Google metadata
  (`full_name`), `{}` metadata, NULL metadata, and a whitespace-only name; check `public."User".name`.
- **B3** per spec (await both checks; pending-receipt delete restricted to uploader;
  `linkReceiptToDebts` requires uploader or a party on an already-linked debt; routes
  `PATCH/DELETE /api/receipts/[id]` map `Receipt not found` → 404, messages starting with
  `Access denied` → 403; also map `Access denied…` → 403 in `POST /api/receipts/upload`).
  Implement `getSignedImageUrls` (contract above). Tests per spec B3 + getSignedImageUrls.
- **B13** `userService.deleteAccount(userId)` + `DELETE /api/user` → `{ message: "Account deleted" }`.
  One interactive transaction, in this order: delete GroupInvites addressed to their email (any
  status — the email FK is `ON UPDATE CASCADE`); delete pending GroupInvites they sent; delete
  all their Friend rows; delete their GroupMember rows; delete their Tabs; `isActive=false` on
  Alerts where lender or borrower; cancel (`status: "cancelled"`, `resolvedAt`) pending
  DebtTransactions they requested; set `status: "inactive"` on RecurringPayments they lend;
  delete their PaypalAccount; collect + delete receipts they uploaded with no linked debts;
  finally `user.update({ name: "Deleted user", email: "deleted+<id>@users.brokebesties.invalid" })`.
  After commit: remove those receipts' storage objects (`receipts/{id}`, best effort, logged),
  then `createAdminClient().auth.admin.deleteUser(userId)`; an auth "user not found" (404) counts
  as success (retries are safe); other errors throw (route → 500). A missing DB user row skips the
  transaction but still deletes the auth user. Tests: operations issued, admin delete called,
  404 tolerated, route 401/200/500.
- **B14** `supabase/config.toml`: add the redirect URLs and enable Apple **by editing the existing
  `[auth.external.apple]` table in place** (a duplicate TOML table breaks `supabase start`).
- **Stripe webhook** (README bug list / P.7): no unsigned fallback. Missing
  `STRIPE_WEBHOOK_SECRET` → 500; missing `stripe-signature` → 400; bad signature → 400. Tests.
- Fix the 6 pre-existing type errors in `src/policies/policies.test.ts` (types only).

### B — REST parity routes (spec B4–B12, B15)

Exactly as the spec tables, plus rule 2 (JSON/type validation → 400). Notes:
- B4 tabs: `POST` → 201 `{ tab }`, default status `borrowing`; `PATCH/DELETE /api/tabs/[id]`.
- B5 `POST /api/invites/[id]/reject` → `{ message: "Invite rejected" }`;
  `DELETE /api/invites/[id]` → `{ message: "Invite cancelled" }`. A user without an email can't
  reject (403).
- B6 `GET /api/groups/[id]/debts`, `POST /api/groups/[id]/members` (201 `{ member }`),
  `GET /api/groups/[id]` → 404 when the message starts with `Group not found`.
- B8 `GET /api/friends/search?q=` (empty → `[]`), `GET /api/friends/recent?limit=` (default 5,
  clamp 1–20, garbage → 5), `POST /api/friends` accepts `{ email }` (trim + lowercase lookup,
  404 `User not found`) or `{ recipientId }` (existing behavior unchanged).
- B9 `GET /api/alerts?role=lender`.
- B10 `GET /api/me/counts` → `NavCounts` (not wrapped).
- B11 `src/lib/dashboard-data.ts: getDashboardData(user: { id: string; email?: string | null })`
  returns exactly the spec JSON (`user: { id, email, name }` from the DB row, falling back to the
  auth email / `null` name). `dashboard/page.tsx` uses it (same props to the client as today);
  `GET /api/dashboard` returns it.
- B12 `recurringPaymentService.resolveBorrowerInputs(inputs)` turns
  `({ userId } | { email }) & { splitPercentage }` into `{ userId, splitPercentage }` (email:
  trim + lowercase; missing → `User with email <email> not found`; neither → 400
  `Each borrower needs an email or userId`); the route uses it.
- B15 `POST /api/debt-transactions`: `Debt not found` → 404.

### C — PayPal core (spec P.1–P.8, P.11–P.12)

`src/lib/paypal.ts` exports (plain `fetch`, no SDK):
`paypalEnv()` (`"live"` only when `PAYPAL_ENV === "live"`, else sandbox), `paypalBase()`,
`paypalWebBase()` (`https://www.sandbox.paypal.com` / `https://www.paypal.com`),
`getPaypalCredentials()` / `getAppUrl()` (trailing `/` trimmed) / state secret (≥ 32 chars) —
each throws `PaypalConfigError` when missing; `getAppAccessToken()` (client-credentials, cached
until `expires_in - 60s`, in-flight requests de-duplicated, cache keyed by env + client id);
`paypalFetch(path, init & { requestId?, accessToken? })` (Bearer + JSON headers,
`PayPal-Request-Id` when given, 30 s timeout, one retry with a fresh app token on 401, throws
`PaypalError` parsed from `{ name, message, debug_id, details }` or OAuth
`{ error, error_description }`, falls back to the `paypal-debug-id` header);
`exchangeAuthorizationCode(code)`, `fetchUserInfo(accessToken)`
(`/v1/identity/oauth2/userinfo?schema=paypalv1.1`); `signState(payload)` / `verifyState(state)`
(HMAC-SHA256, base64url `payload.signature`, adds `exp` = now + 10 min and a random nonce,
constant-time compare, `null` when tampered/expired/malformed) and `decodeStateUnverified(state)`
(only to pick an allow-listed scheme for an error redirect); `APP_SCHEMES`
(`brokebesties`, `brokebesties-preview`, `brokebesties-dev`), `schemeForVariant(variant)`
(`development` → `-dev`, `preview` → `-preview`, anything else → `brokebesties`),
`isAppScheme(x)`; `checkoutUrl(orderId)`; `amountToCents("42.50")` (exact decimal parsing, no
floats; `null` if malformed) and `centsToAmount(4250)` → `"42.50"`; a test-only cache reset.

`PaypalPolicy.canPayDebt(userId, debt, pendingTx)` = borrower ∧ `status === "pending"` ∧ `!pendingTx`.

Service behavior (on top of the stub JSDoc):
- **connect:** authorize URL = `{web}/signin/authorize?flowEntry=static&client_id=…&response_type=code&scope=openid%20email%20https%3A%2F%2Furi.paypal.com%2Fservices%2Fpaypalattributes&redirect_uri={APP_URL}/api/paypal/callback&state=…`
  (encodeURIComponent, not URLSearchParams). State carries `userId`, `platform`, and for iOS the
  allow-listed `scheme`. **callback:** reasons as documented; `error=access_denied` or no code →
  `cancelled`; userinfo → `payer_id` (missing → `no_payer_id`), primary (else first) `emails[]`
  entry with `confirmed` (bool or `"true"`), falling back to `email` / `email_verified` (missing →
  `no_email`); payer id linked to another user → `in_use` (also on a P2002 race); upsert by
  `userId` (re-connect updates payer id, email, verified, `connectedAt`). The user's PayPal token
  is never stored.
- **order:** config check first; load debt (+ lender's PaypalAccount + pending transactions);
  messages/statuses per JSDoc, checked in this order: 404, borrower, paid, pending tx, lender not
  connected, in-progress (CREATED|APPROVED newer than 3 h), amount (`Math.round(amount*100) < 1`).
  Create the row (`CREATED`, `amountCents`, `currency: "USD"`, `payeePayerId`, `platform`,
  `returnScheme` = `schemeForVariant(appVariant)` for iOS else `null`), then `POST
  /v2/checkout/orders` with `PayPal-Request-Id: payment.id` and the spec P.6 body (`reference_id
  "debt-<id>"`, `custom_id` = payment id, description `Broke Besties: <desc> (debt #<id>)` or
  `Broke Besties: debt #<id>`, max 127 chars, value `centsToAmount`, `payee.merchant_id`,
  experience context; `return_url {APP_URL}/paypal/return?pp=<id>&platform=<platform>`, cancel
  adds `&cancelled=1`). Approve link = `payer-action` (fallback `approve`). Any failure → mark the
  row FAILED (reason) → 502 (`PAYEE_*` issues → the 409 payee message). Save `orderId`.
- **capture:** config check; 404/403; COMPLETED → 200 idempotent; REFUNDED → 409; FAILED → 409;
  no `orderId` → 409 not approved. `POST /v2/checkout/orders/{orderId}/capture` with
  `PayPal-Request-Id: capture-<id>`, `Prefer: return=representation`, body `{}`. Issues:
  `ORDER_NOT_APPROVED` → 409 (no state change); `INSTRUMENT_DECLINED` → 402 (no state change);
  `ORDER_ALREADY_CAPTURED` → `GET /v2/checkout/orders/{orderId}` and continue with its capture;
  other **4xx** → `markFailed` + 502; **5xx/network/timeout → 502 without changing state**
  (outcome unknown; a retry reconciles). Capture `COMPLETED` → `completeFromCapture` (payee taken
  from the capture, else the order's `purchase_units[0].payee`) → 200 `{ payment, debt }`
  (`"failed"` → 502 verify message); `PENDING` → APPROVED → 202; anything else → FAILED → 502.
- **completeFromCapture** (P.8): already COMPLETED/REFUNDED → `already_completed`. Verify
  `amountToCents(capture.amount.value) === amountCents`, currency `USD`, payee `merchant_id ===
  payeePayerId` (if the capture lacks `payee`, fetch the order; still missing → mismatch).
  Mismatch → FAILED (reason) + `console.error`, `failed`. Else one `$transaction`: claim with
  `paypalPayment.updateMany({ where: { id, status: { notIn: ["COMPLETED","REFUNDED"] } } … })`
  (count 0 → `already_completed`); `debt.updateMany({ where: { id, status: "pending" } }, paid)`;
  if it settled: alert off (`alert.updateMany`), pending transactions cancelled, audit
  `DebtTransaction` (`confirm_paid`, `approved`, requester = payer, both approved,
  `reason: "Paid with PayPal (capture <captureId>)"`, `resolvedAt`) → `completed`; else
  `already_settled`. After commit (never inside the transaction, never failing the call): email the
  lender (`completed`) or both people with `alreadySettled: true` (`already_settled`).
- **markRefunded:** idempotent (REFUNDED → no-op); claim via `updateMany(status not REFUNDED)`;
  if the debt is `paid` and its latest approved transaction's reason contains
  `(capture <captureId>)` → debt back to `pending` + `DebtTransaction { confirm_paid, cancelled,
  requester: payee, reason: "PayPal payment refunded", resolvedAt }`. Email both people after
  commit. `// ponytail:` partial refunds are treated as full refunds.
- **webhook:** `verifyWebhookSignature` posts `{ auth_algo, cert_url, transmission_id,
  transmission_sig, transmission_time, webhook_id, webhook_event }` with the **raw body embedded
  verbatim** as `webhook_event` (re-serializing can break verification). `handleWebhook`: find the
  payment by `custom_id`, order id (`resource.id` for order events,
  `supplementary_data.related_ids.order_id`), or capture id (`resource.id` for capture events,
  `related_ids.capture_id`, `links[rel=up]` `/v2/payments/captures/{id}`). Unknown →
  `{ handled: false }`. `CHECKOUT.ORDER.APPROVED` → capture (same internals as `capturePayment`,
  no user check; flow errors are logged, not thrown); `PAYMENT.CAPTURE.COMPLETED` →
  `completeFromCapture`; `PENDING` → APPROVED (from CREATED/CANCELLED); `DENIED` → `markFailed`;
  `REFUNDED`/`REVERSED` → `markRefunded`. Unexpected errors propagate (route → 500, PayPal retries).
- **getReturnRedirect:** see JSDoc. Unknown payment → `{APP_URL}/debts?paypal=error`. Only mark
  CANCELLED when `orderToken === payment.orderId`. iOS scheme re-checked against the allow-list
  (fallback `brokebesties`). If `NEXT_PUBLIC_APP_URL` is missing return a relative path
  (the route resolves it against the request URL).
- **getDebtPaypalInfo:** `lenderConnected` = lender has a PaypalAccount; `canPay` as in §1;
  payments newest first, mapped to `PaypalPaymentInfo`.
- Emails: two react-email templates in the style of `tab-marked-paid.tsx`; service methods in the
  style of the existing ones. Tests: everything in spec P.12 for lib + service, plus policy tests.

### D — PayPal HTTP layer + debt detail API

`src/lib/paypal-http.ts: paypalErrorResponse(error, { configStatus? })` → `PaypalFlowError` →
`{ error, ...body }` with its status; `PaypalConfigError` → 503 `{ error: "PayPal is not configured" }`
(webhook passes 500); anything else → `console.error` + 500 `{ error: "Internal server error" }`.
`src/lib/rate-limit.ts`: fixed-window in-memory limiter (`ponytail:` per-instance; Upstash for a
global limit). Routes:

| Route | Behavior |
|---|---|
| `GET /api/paypal/connect?platform=ios\|web` | auth; platform `ios` only when exactly `ios`; `{ url: buildConnectUrl({ userId, platform, appVariant: x-app-variant header }) }` |
| `GET /api/paypal/callback` (public) | `302` to `handleOAuthCallback({ code, state, error })` (resolve against `request.url`) |
| `GET /api/paypal/account` | `{ account }` |
| `DELETE /api/paypal/account` | `disconnect` → `{ message: "PayPal disconnected" }` |
| `POST /api/debts/[id]/paypal/order` | auth; 400 `Invalid debt ID`; rate limit 5/min/user → 429 `Too many PayPal requests. Try again in a minute.` + `Retry-After`; body optional (`{ platform: "ios" }` → ios, anything else/invalid → web); 201 `{ paymentId, approveUrl }` |
| `POST /api/paypal/payments/[id]/capture` | auth; 200 `{ payment, debt }` or 202 `{ payment }` |
| `GET /paypal/return` (public, `src/app/paypal/return/route.ts`) | `302` to `getReturnRedirect({ paymentId: pp, orderToken: token, cancelled: cancelled === "1" })` |
| `POST /api/paypal/webhook` (public) | raw body; verify: config error → 500, thrown → 500, false → 400 `Invalid signature`; bad JSON → 400; `handleWebhook` throws → 500; else 200 `{ received: true }` |
| `GET /api/debts/[id]` (changed) | `{ debt, transactions, receiptImageUrls, paypal }`: transactions from `debtTransactionService.getDebtTransactions`, then in parallel `receiptService.getSignedImageUrls(debt.receipts ids)` and `paypalService.getDebtPaypalInfo(debt, user.id, transactions.some(pending))`; existing error mapping kept |

All redirects use status 302 and `new URL(target, request.url)` (custom-scheme targets pass
through unchanged — assert the `Location` header in tests). `sample.env` gets the P.3 block
(empty values, comments). Mock `@/services/paypal.service` in route tests.

### E — PayPal web UI (spec P.10)

- `profile/page.tsx` loads `paypalService.getAccount` alongside the user and passes the page's
  `searchParams` (`paypal`, `reason`) down. New PayPal card in the existing card style:
  not connected → "Connect PayPal so friends can pay you back in one tap." + "Connect PayPal"
  (`GET /api/paypal/connect?platform=web` → `window.location.assign(url)`); connected →
  "Connected as {email}" + "Verified" badge (only when verified) + "Disconnect" (AlertDialog
  "Disconnect PayPal?" / "Friends won't be able to pay you with PayPal until you connect again.")
  → `DELETE /api/paypal/account` → toast "PayPal disconnected" + `router.refresh()`. On
  `?paypal=connected` toast "PayPal connected"; on `?paypal=error` toast by reason (`in_use` →
  "That PayPal account is already linked to another Broke Besties account", `state` → "The PayPal
  connection expired. Try again.", `cancelled` → "PayPal connection cancelled", else "Couldn't
  connect PayPal. Try again."); then `router.replace("/profile")`. Fire once (ref guard).
- `debts/[id]/page.tsx`: use `receiptService.getSignedImageUrls` (delete the inline loop) and
  `paypalService.getDebtPaypalInfo(debt, user.id, hasPending)`; pass `paypal` and the
  `?paypal=approved|cancelled&pp=` return info to the client.
- Debt detail client: when `canAct` and `paypal.canPay` → "Pay ${amount} with PayPal" button next
  to "Mark as paid" (`POST /api/debts/{id}/paypal/order` `{ platform: "web" }` → assign
  `approveUrl`; 409 with `approveUrl` → resume it; otherwise toast `error`). Borrower + `canAct` +
  `!paypal.lenderConnected` → muted "{lender} hasn't connected PayPal". Latest payment `APPROVED`
  → note "PayPal is processing your payment. We'll mark this debt paid when it clears." On return
  `approved` → `POST /api/paypal/payments/{pp}/capture` once (ref guard, "Confirming payment…"
  state) → 200 toast "Paid {lender} ${amount} with PayPal", 202 toast "PayPal is processing your
  payment", error → toast `error`; `cancelled` → toast "PayPal payment cancelled"; then
  `router.replace("/debts/{id}")` + `router.refresh()`.
- Activity card: `confirm_paid` with reason starting "Paid with PayPal" gets a "PayPal" badge.
- Put pure logic (reason → message, `isPaypalTransaction`, return-param parsing) in `.ts` helpers
  with vitest tests; UI must type-check and lint clean.
