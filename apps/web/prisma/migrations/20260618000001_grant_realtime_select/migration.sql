-- Supabase Realtime evaluates row visibility as the subscribing role.
-- Prisma-owned tables grant nothing to `authenticated`, so realtime delivers
-- no events. Grant SELECT so the logged-in browser client receives changes.
-- ponytail: dev-only grant; RLS is off, so any authenticated user can read all
-- GroupMember rows via PostgREST/Realtime. Enable RLS + a self-scoped policy
-- before production.
GRANT SELECT ON "GroupMember" TO authenticated;
