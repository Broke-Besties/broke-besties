# Broke Besties — MCP Server

A Model Context Protocol (MCP) server for Broke Besties, so you can bring your debts and recurring payments into AI clients like Claude, Cursor, OpenCode, etc. It runs remotely over Streamable HTTP and authenticates through a real OAuth 2.1 flow (Google SSO via Supabase) — no API keys, no cookie copying.

Spec: see [`docs/superpowers/specs/2026-09-27-mcp-server-design.md`](../../docs/superpowers/specs/2026-09-27-mcp-server-design.md).

## Tools

| Tool | What it does |
| --- | --- |
| `list_my_debts` | Debts where you are lender or borrower (`type`, `status` filters) |
| `get_debt` | Full details of one debt (you must be a party) |
| `create_debt` | Create a debt you are the lender of (`amount`, `borrowerId`, `description`) |
| `request_debt_payment` | Request `drop` / `modify` / `confirm_paid` on a debt (the other party approves) |
| `respond_debt_request` | Approve or reject a pending debt-change request |
| `list_my_recurring_payments` | Recurring payments you lend or borrow, with borrower splits |
| `create_recurring_payment` | Recurring payment you are the lender of (`frequency` = days; borrower splits must sum to 100%) |
| `toggle_recurring_payment` | Activate/pause one of your recurring payments |

Every tool is scoped to the signed-in user — there is no way to pass a user id. Tabs are intentionally **not** exposed (their approve/reject workflow belongs in the app).

## How auth works

1. On first connect your MCP client gets a `401` pointing at `/.well-known/oauth-protected-resource`, opens a browser for `/authorize` (RFC 8414 + RFC 9728 + RFC 7591 dynamic client registration + PKCE S256).
2. `/authorize` redirects you to Supabase Auth (Google SSO). This server never sees your Google password.
3. `/callback` exchanges the Supabase code server-side and mints a **first-party access token** (1h JWT) + refresh token (30d, rotated on every use) for the MCP client.
4. Tool calls hit `POST /mcp` with `Authorization: Bearer <access token>`; tokens refresh automatically via `POST /token`.

Stack: Node 20+, `@modelcontextprotocol/sdk` (stateless Streamable HTTP), Prisma driver adapter → same database as the web app, service layer that mirrors `apps/web/src/services` (same validations/messages, no email sending).

## Getting started

```bash
cd apps/mcp-server
cp sample.env .env         # fill in values
pnpm install               # also generates the Prisma client (schema synced from apps/web)
pnpm dev                   # http://localhost:8082
```

Env vars: `MCP_BASE_URL` (public origin), `PORT`, `DATABASE_URL`, `SUPABASE_URL`/`SUPABASE_ANON_KEY` (or the `NEXT_PUBLIC_*` forms), `MCP_JWT_SECRET` (`openssl rand -base64 32`).

### Pointing a client at it

```json
{
  "mcpServers": {
    "broke-besties": {
      "url": "http://localhost:8082/mcp"
    }
  }
}
```

The client's first attempt gets a 401 with OAuth discovery headers; it should open the browser to complete Google SSO and then cache the tokens itself.

### Supabase notes (local + prod)

- Local Supabase: Google provider must be enabled (`supabase/config.toml`) or via direct config for hosted (`SUPABASE_AUTH_EXTERNAL_GOOGLE_*` like apps/web).
- `MCP_BASE_URL`/`PORT` are the source of truth for OAuth issuer/redirects — if the server runs behind a proxy, set `MCP_BASE_URL` to the proxied origin.

## Schema sync

This app uses the **same Prisma models as apps/web**. `prisma/schema.prisma` here is a synced copy (`pnpm sync-schema` refreshes it from `../web/prisma/schema.prisma`; `postinstall` regenerates the client). If you add a migration to apps/web, re-sync.

## Scripts

| Script | What |
| --- | --- |
| `pnpm dev` | `tsx watch` dev server |
| `pnpm start` | Run server (tsx) |
| `pnpm generate` | Re-sync + regenerate Prisma client |
| `pnpm typecheck` | `tsc --noEmit` (strict) |
| `pnpm test` | Vitest (81 tests: services, tools, OAuth store, tokens, endpoints) |

## Notes / limits

- OAuth state (clients, codes, refresh tokens) is in-memory per process — fine for MVP; swap in Redis for multi-instance deploys.
- The web app's cookie-based API routes are untouched — this server talks to Postgres directly with the same service-layer rules, so users created in the web app work as-is.
- No email notifications are sent from here.
