# MCP Server — OAuth + basic debt/recurring-payment tools

**Date:** 2026-09-27 · **Branch:** `feat/mcp-server`
**Scope:** A standalone Model Context Protocol (MCP) server that lets users plug Broke Besties into MCP clients (Claude Desktop, Cursor, OpenCode, etc.). It exposes a small set of tools over debts and recurring payments, authenticated by a real OAuth 2.1 flow so it can run remotely ("type": "http" MCP server), not just stdio.

**Out of scope:** tabs (deliberately excluded — their approve/reject workflow is interactive and better left to the app), wallet/Stripe, alerts, groups CRUD, friends CRUD, the LLM agent.

## Existing state (constraints discovered on `main`)

- Auth is **Supabase Auth (GoTrue)** via `@supabase/ssr` cookie sessions; Google OAuth is configured at the Supabase level. There is no NextAuth and **no token-issuing endpoint** in the web app.
- All `apps/web` API routes authenticate via `getUser()` (cookies) — the exception being the cron route, which accepts `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>`.
- Service layer lives in `apps/web/src/services` as singletons (`debtService`, `debtTransactionService`, `recurringPaymentService`) and talks to Prisma (`DATABASE_URL`, `@prisma/adapter-pg` + shared `pg` Pool, globalThis singleton).
- Repo layout: separate apps under `apps/` with independent pnpm projects (no root workspace), vitest with the hand-rolled `src/test/mocks.ts` mock-prisma pattern, specs in `docs/superpowers/specs/`.

## Design

### 1. Location & runtime

New standalone app at `apps/mcp-server/` (own `package.json`, pnpm, `tsconfig.json`, vitest) — consistent with the "each app is self-contained" convention.

- Runtime: Node 20+, `tsx` for dev, plain `node` on the compiled output.
- HTTP server: native `node:http` routed with a tiny hand router (no new framework; keeps deps minimal).
- MCP: `@modelcontextprotocol/sdk` — stateless `StreamableHTTPServerTransport` mounted at `POST /mcp` (handle modern clients), `GET /mcp` returns 405.
- Docs for the user placed in `apps/mcp-server/README.md`; design spec is this file.

```
apps/mcp-server/
  package.json  tsconfig.json  vitest.config.ts  sample.env  README.md
  src/
    index.ts               http server + route table (auth, token, register, tools call)
    config.ts              env parsing/defaults (BASE_URL, SUPABASE_URL/ANON_KEY, ...)
    lib/prisma.ts          same globalThis + PrismaPg pattern as apps/web
    lib/supabase.ts        Thin GoTrue client (token validation, user lookup)
    lib/http.ts            json responses, readBody, bearer parsing
    auth/
      oauth-store.ts       in-memory: client registrations, auth codes, PKCE, consumed-token cache
      bearer.ts            Authorization: Bearer <supabase-access-token> -> { userId, email } (supabase.auth.getUser)
    servers/tools.ts       MCP tool definitions + dispatch to handlers
    tools/debts.ts         handlers backed by local service ports
    tools/recurring-payments.ts
    *.test.ts colocated
    test/mocks.ts          copy of apps/web/src/test/mocks.ts pattern (mock prisma + emailService)
```

### 2. OAuth flow — RFC 9728 discovery + dynamic client registration + PKCE

Because the web app cannot mint third-party tokens, the MCP server does its own OAuth 2.1 against **Supabase as the upstream IdP** with short-lived first-party-issued access tokens minted by the MCP server.

Endpoints (all on the MCP server origin):

| Route | Purpose |
|---|---|
| `GET /.well-known/oauth-authorization-server` | RFC 8414 metadata document (advertises the routes below, `code` + `refresh_token` grants, PKCE `S256` required, `resource` parameter support for RFC 8707) |
| `GET /.well-known/oauth-protected-resource` | RFC 9728 protected-resource metadata (points clients at the auth server above; required by newer MCP clients) |
| `POST /register` | RFC 7591 dynamic client registration — stateless clients (e.g. Claude) self-register, gets a `client_id` (rotating `client_secret_issued_at`, public clients allowed with PKCE), persists in oauth-store |
| `GET /authorize` | Mirrors Supabase's `/authorize` — redirects the browser to Supabase Auth (Google SSO) with `redirect_to` pointed back at the MCP server callback, binds a `state` + PKCE `code_challenge` + `resource` (audience) in the in-memory store (TTL 10 min) |
| `GET /callback` | Receives Supabase's code exchange result, validates the resulting Supabase user, then issues a **first-party access token** (JWT, HS256 via `MCP_JWT_SECRET`, `aud=resource`, `iss=mcp-server`, TTL 1 h) + refresh token (opaque, TTL 30 d, single-use rotation), and renders tokens back to the client via the redirect URI with `authorization_code` |
| `POST /token` | `authorization_code` (validates `code_verifier` against the stored `code_challenge`, single-use) and `refresh_token` (rotates the token row) grants; returns `{ access_token, token_type: "Bearer", expires_in, refresh_token }` |

Rationale for issuing first-party tokens instead of passing Supabase JWTs through: GoTrue tokens are opaque to MCP clients' token-refresh logic, we want audience scoping (`resource`), and we don't want to blast Supabase on every tool call. **User identity is still Supabase**: access-token JWT carries `sub` = Supabase `user.id`, which is exactly what `debtService`/`recurringPaymentService` key on (`lenderId`, `borrowerId`, `userId` are Supabase user ids / cuid). Supabase is only hit when exchanging the authorization code and on refresh.

Store: in-memory Maps with TTL sweeper (codes, verifiers, clients, refresh tokens). Acceptable for MVP; Redis is the noted follow-up (see "Future work").

### 3. Tool boundary (bring-your-own-service-layer)

The handlers do **not** call Supabase or raw Prisma directly. The MCP server spins up its own thin service ports that reuse the exact same signatures and error-message strings as the web ones, pointing at the same shared database (Prisma, `DATABASE_URL`) — same validation rules (amount > 0, split % sums to 100, no self-debt, borrower must exist), same statuses (`pending`/`paid`/`active`/`inactive`), same `frequency` semantics (interval in **days**). We deliberately **do not import** `apps/web/src/services` (different package, path alias `@/`, and `next/headers` import chains) — we replicate the three functions we need and note in README that behavioral parity is enforced by tests mirroring the web tests.

Email sending is skipped (no Resend in this app; notifications happen via the web app's existing alerts).

#### Debt tools

| Tool | Arguments | Backing |
|---|---|---|
| `list_my_debts` | `type?: "lending"\|"borrowing"`, `status?: string` | `where OR [lenderId, borrowerId]` + filters, includes lender/borrower/group, ordered `createdAt desc` |
| `get_debt` | `debtId: number` | `findUnique` + policy check (lender/borrower only) |
| `create_debt` | `amount: number`, `borrowerId: string (uuid)`, `description?: string`, `groupId?: number` | same validation as `debtService.createDebt`, status `pending` |
| `request_debt_payment` | `debtId: number`, `type: "drop"\|"modify"\|"confirm_paid"`, `proposedAmount?`, `proposedDescription?`, `reason?` | creates a DebtTransaction (`status: pending`); borrower/lender then approves in the web UI |
| `respond_debt_request` | `transactionId: number`, `approve: boolean` | mirrors `respondToTransaction` incl. approve/drop→delete/modify→apply/confirm_paid→paid under `$transaction` |

#### Recurring payment tools

| Tool | Arguments | Backing |
|---|---|---|
| `list_my_recurring_payments` | `type?: "lending"\|"borrowing"`, `status?: "active"\|"inactive"` | `where lenderId or borrowers.some` + filters, includes lender + borrowers split |
| `create_recurring_payment` | `amount`, `frequency (days)`, `borrowers: [{ userId, splitPercentage }]` (must sum to 100), `description?` | same transactional create (`$transaction` → payment + borrower rows, status `active`) |
| `toggle_recurring_payment` | `id: number` | flips `active`/`inactive` (lender only) |

Errors come back as tool `isError` results with the same human-readable strings (`"Borrower not found"`, `"Split percentages must sum to 100%"`, …) so agents can self-correct. Every tool scopes to `ctx.userId` — the JWT `sub` — which is passed as `lenderId`/`userId`; there is **no** way for the caller to pass an arbitrary user id (the `lender_of`/`user_s` argument is derived from the token, never from the tool call, similar to how web routes take `lenderId` from the session).

### 4. Transport & calling convention

- `POST /mcp` with `Authorization: Bearer <access_token>`; invalid/missing token → `401` + `WWW-Authenticate: Bearer resource="https://…/.well-known/oauth-protected-resource"` so MCP clients automatically kick off the flow above.
- Server `name: "broke-besties"`, version from `package.json`; tools listed lazily per identify-yourself after auth; JSON-RPC only, no SSE (streamable HTTP, stateless).

## Testing

- Vitest colocated (`*.test.ts`), mock-prisma/singletons copied from `apps/web/src/test/mocks.ts` (same `makeUser`/`makeDebt`/`LENDER_ID`/`BORROWER_ID` conventions).
- `tools/debts.test.ts` + `tools/recurring-payments.test.ts` mirror the web service tests: happy path + every rejection message ("Valid amount is required", "Cannot add the same borrower multiple times", …), user-scoping (outsider cannot touch someone else's debt / recurring payment).
- `auth/bearer.test.ts` + `lib/tokens.test.ts`: 401 on missing/expired/garbage/wrong-alg tokens, issuer/audience checks, PKCE RFC 7636 test vector.
- `oauth-endpoints.test.ts` (integration, in-process HTTP): discovery metadata, dynamic client registration (+ bad redirect rejection), full `authorization_code` grant with PKCE wrong-verifier rejection, single-use code replay, refresh rotation + reuse detection.
- No e2e against a live Supabase in CI (authorize/callback is exercised only up to the Supabase boundary).

## Future work

- Replace in-memory oauth-store with Redis/postgres backends for multi-instance deploys.
- `update_debt`, `delete_debt`, `list_debt_requests` tools once clients show demand.
- Tab tools remain excluded permanently unless the client-side UX complaint changes.
- Streamable HTTP + SSE (client→server notifications) if we add subscription-style alerts.
