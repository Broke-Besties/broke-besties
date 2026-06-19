# Session log — 2026-06-18: seed data + prod deploy fix + RLS

## 1. Seed/test data
- [x] Added Friend seeding to `apps/web/prisma/seed.ts` (existing seed had none → friends page was empty).
- [x] Ran seed against **local** Supabase. Logins (all password `password123`):
  - `daniel.venistan@mail.utoronto.ca` (main), `alice@`, `bob@`, `charlie@`, `diana@` `example.com`
  - Populated: 3 groups, 15 debts, 8 alerts, 3 tabs, 3 debt transactions, 4 recurring payments, 5 friendships (4 accepted + 1 pending).
- Login is email/password or Google OAuth (`/login`).

## 2. Pushed UI revamp to main
- [x] Merged `feature/ui-structure-revamp` was already on `main`; pushed 19 commits to `origin/main`.
- Build passed locally before push; `.env`/secrets confirmed untracked.

## 3. Production deploy failure — root cause + fix
- **Symptom:** `production-deploy.yml` (runs `prisma migrate deploy` on push to main) failed:
  `FATAL: (ENOTFOUND) tenant/user postgres.oagxxhjcsufxbfjufvnt not found`.
- **Root cause:** prod Supabase project `oagxxhjcsufxbfjufvnt` was **paused** (`INACTIVE`, free-tier auto-pause). Paused projects lose DNS → `NXDOMAIN` → pooler "tenant not found". Not a code/secrets issue.
- **Fix (via Supabase MCP):**
  - [x] `restore_project` → waited for `ACTIVE_HEALTHY`. Data intact (User=8 rows), no migration drift.
  - [x] Verified pending migrations' preconditions on prod, then re-ran deploy → all green; both realtime migrations recorded.

## 4. Security: RLS on GroupMember
- Prior migration `grant_realtime_select` exposed ALL GroupMember rows to `authenticated` (RLS off).
- [x] Added `apps/web/prisma/migrations/20260618000002_groupmember_rls/migration.sql`:
  enables RLS + policy "Members read own membership rows" (`userId = auth.uid()::text`).
- [x] Committed + pushed → deployed (run 27793957516 success). Verified on prod: RLS enabled, policy live, migration recorded.
- Prisma server-side queries use direct `postgres` conn → bypass RLS, app unaffected.

## Open / future
- [ ] Free-tier project auto-pauses after ~1 week idle → recurs unless upgraded or pinged.
- [ ] `ponytail:` in the RLS migration: own-rows-only. If live "co-member joined my group" is needed, add a group-scoped policy via a SECURITY DEFINER helper (self-referential RLS recurses).
- [ ] Run `get_advisors` periodically for Supabase security/perf lint.
