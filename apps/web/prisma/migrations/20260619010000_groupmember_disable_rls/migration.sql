-- The groups list live-refreshes via postgres_changes on "GroupMember", but
-- RLS breaks that path: Realtime's WALRUS engine (realtime.apply_rls) fails on
-- Prisma's PascalCase "GroupMember" table ("relation does not exist"), so no
-- change events are delivered. Drop the policy and disable RLS to restore live
-- delivery. The app reads GroupMember via Prisma (direct postgres connection),
-- and the authenticated GRANT SELECT keeps Realtime working as before.
DROP POLICY IF EXISTS "Members read own membership rows" ON "GroupMember";
ALTER TABLE "GroupMember" DISABLE ROW LEVEL SECURITY;
